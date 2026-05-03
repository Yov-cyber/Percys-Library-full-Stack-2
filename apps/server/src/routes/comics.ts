import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../db";
import { getCover } from "../services/covers";
import { getPage, getThumb } from "../services/pages";
import { evaluateAchievements, recordReadingDay } from "../services/achievements";
import { asyncHandler } from "../lib/async-handler";
import { naturalCompare } from "../lib/natural-sort";
import { getOwnerId } from "../lib/owner";

export const comicsRouter = Router();

// Bulk operations on a list of comics. The op string is intentionally a
// closed enum so the wire format is easy to validate and audit.
const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  op: z.enum([
    "favorite",
    "unfavorite",
    "markCompleted",
    "markUnread",
    "category",
    "delete",
  ]),
  // Only used for op="category"; null clears the category.
  category: z.string().nullable().optional(),
});

comicsRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { ids, op, category } = parsed.data;
    let affected = 0;
    switch (op) {
      case "favorite":
      case "unfavorite": {
        const r = await prisma.comic.updateMany({
          where: { ownerId, id: { in: ids } },
          data: { isFavorite: op === "favorite" },
        });
        affected = r.count;
        // Mirror the individual /favorite endpoint so favorite-based
        // achievements (fav-1, fav-5, library-curator, …) unlock right
        // away after a bulk operation.
        await evaluateAchievements(ownerId);
        break;
      }
      case "markCompleted": {
        // Move currentPage to the last index and flip completed=true.
        // Done in two queries because Prisma doesn't yet support "set
        // column to another column's value" in updateMany.
        const comics = await prisma.comic.findMany({
          where: { ownerId, id: { in: ids } },
          select: { id: true, pageCount: true },
        });
        await Promise.all(
          (comics as Array<{ id: string; pageCount: number }>).map((c: { id: string; pageCount: number }) =>
            prisma.comic.update({
              where: { id: c.id },
              data: {
                completed: true,
                currentPage: Math.max(0, c.pageCount - 1),
                lastReadAt: new Date(),
              },
            }),
          ),
        );
        affected = comics.length;
        await evaluateAchievements(ownerId);
        break;
      }
      case "markUnread": {
        const r = await prisma.comic.updateMany({
          where: { ownerId, id: { in: ids } },
          data: { completed: false, currentPage: 0 },
        });
        affected = r.count;
        break;
      }
      case "category": {
        const r = await prisma.comic.updateMany({
          where: { ownerId, id: { in: ids } },
          data: { category: category ?? null },
        });
        affected = r.count;
        break;
      }
      case "delete": {
        const targets = await prisma.comic.findMany({
          where: { ownerId, id: { in: ids } },
          select: { id: true, path: true, format: true },
        });
        await Promise.all(
          targets.map(async (c) => {
            try {
              if (c.format === "folder") {
                await fs.rm(c.path, { recursive: true, force: true });
              } else {
                await fs.unlink(c.path);
              }
            } catch (err) {
              // Log but still remove the DB row so the comic disappears
              // from the user's library; the orphan-cleanup pass picks
              // up the leftover file later.
              // eslint-disable-next-line no-console
              console.warn(
                `[percys] could not delete file for comic ${c.id} at ${c.path}:`,
                err,
              );
            }
          }),
        );
        const r = await prisma.comic.deleteMany({ where: { ownerId, id: { in: ids } } });
        affected = r.count;
        break;
      }
    }
    res.json({ ok: true, affected });
  }),
);

comicsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const comic = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId } });
    if (!comic) return res.status(404).json({ error: "Not found" });
    res.json({
      id: comic.id,
      title: comic.title,
      format: comic.format,
      pageCount: comic.pageCount,
      currentPage: comic.currentPage,
      completed: comic.completed,
      isFavorite: comic.isFavorite,
      category: comic.category,
      sizeBytes: Number(comic.sizeBytes),
      lastZoom: comic.lastZoom,
    });
  }),
);

// Resolve the next comic in the same series for "continue reading" UX.
// Heuristic: comics living in the same parent directory, ordered by
// natural sort of their on-disk path. If the current comic is the last
// one in its folder we return null so the client can hide the prompt.
comicsRouter.get(
  "/:id/next",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const current = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId } });
    if (!current) return res.status(404).json({ error: "Not found" });
    const parent = path.dirname(current.path);
    const siblings = await prisma.comic.findMany({
      where: { ownerId, path: { startsWith: parent + path.sep } },
      orderBy: { path: "asc" },
    });
    type Sibling = {
      id: string;
      path: string;
      title: string;
      format: string;
      pageCount: number;
      currentPage: number;
      completed: boolean;
    };
    // findMany already sorts lexicographically; for natural ordering (so
    // "Vol 10" sorts after "Vol 2") we re-sort in JS by basename.
    const sorted = (siblings as Sibling[])
      .filter((c: Sibling) => path.dirname(c.path) === parent)
      .sort((a: Sibling, b: Sibling) => naturalCompare(path.basename(a.path), path.basename(b.path)));
    const idx = sorted.findIndex((c: Sibling) => c.id === current.id);
    const next = idx >= 0 ? sorted[idx + 1] : null;
    if (!next) return res.json({ next: null });
    res.json({
      next: {
        id: next.id,
        title: next.title,
        format: next.format,
        pageCount: next.pageCount,
        currentPage: next.currentPage,
        completed: next.completed,
      },
    });
  }),
);

comicsRouter.get(
  "/:id/cover",
  asyncHandler(async (req, res) => {
    const buf = await getCover(req.params.id);
    if (!buf) return res.status(404).end();
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(buf);
  }),
);

comicsRouter.get(
  "/:id/pages/:n",
  asyncHandler(async (req, res) => {
    const n = parseInt(req.params.n, 10);
    if (Number.isNaN(n) || n < 0) return res.status(400).end();
    let autoCrop: boolean;
    let quality: "high" | "balanced" | "fast" | undefined;
    if (req.query.crop === "1") autoCrop = true;
    else if (req.query.crop === "0") autoCrop = false;
    else {
      const ownerId = getOwnerId(req);
      const settings = await prisma.settings.findUnique({ where: { ownerId } });
      autoCrop = settings?.autoCropMargins ?? false;
    }
    // Quality may come from the URL (so the client can override per-tab)
    // or fall back to the user's setting. Unknown values silently default
    // to balanced — this stays compatible with old reader URLs.
    const q = String(req.query.q ?? "");
    if (q === "high" || q === "balanced" || q === "fast") {
      quality = q;
    } else {
      const ownerId = getOwnerId(req);
      const settings = await prisma.settings.findUnique({ where: { ownerId } });
      const s = settings?.imageQuality;
      quality = s === "high" || s === "balanced" || s === "fast" ? s : "balanced";
    }
    const page = await getPage(req.params.id, n, { autoCrop, quality });
    if (!page) return res.status(404).end();
    res.setHeader("Content-Type", page.mime);
    // The crop variant + quality are encoded in the URL query, so the
    // browser cache will naturally key separately for each combination.
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(page.data);
  }),
);

comicsRouter.get(
  "/:id/thumbs/:n",
  asyncHandler(async (req, res) => {
    const n = parseInt(req.params.n, 10);
    if (Number.isNaN(n) || n < 0) return res.status(400).end();
    const buf = await getThumb(req.params.id, n);
    if (!buf) return res.status(404).end();
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(buf);
  }),
);

const progressSchema = z.object({ page: z.number().int().min(0), completed: z.boolean().optional() });

comicsRouter.post(
  "/:id/progress",
  asyncHandler(async (req, res) => {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { page, completed } = parsed.data;
    const ownerId = getOwnerId(req);
    const comic = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId } });
    if (!comic) return res.status(404).json({ error: "Not found" });
    // Clamp `page` to [0, pageCount-1] so a stale or malformed client can't
    // poison the row with a value that would render >100% progress in the
    // library grid.
    const hasPages = comic.pageCount > 0;
    const clampedPage = hasPages ? Math.min(Math.max(0, page), comic.pageCount - 1) : 0;
    const isCompleted = hasPages ? (completed ?? clampedPage >= comic.pageCount - 1) : false;
    await prisma.comic.update({
      where: { id: req.params.id },
      data: {
        currentPage: clampedPage,
        completed: isCompleted,
        lastReadAt: new Date(),
      },
    });
    await recordReadingDay(ownerId);
    await evaluateAchievements(ownerId);
    res.json({ ok: true, completed: isCompleted });
  }),
);

// Zoom is intentionally a separate endpoint. Folding it into /progress
// caused two real bugs in the previous iteration: (1) every zoom save
// went through recordReadingDay/evaluateAchievements, inflating pagesRead
// and racing the achievement engine; (2) the server's auto-detect of
// `completed` from `clampedPage >= pageCount - 1` mis-fires in
// double-spread mode (where the client uses pageCount-2 as the last
// start-of-spread), so a zoom save could overwrite completed=true back
// to false. Keeping zoom in its own route means it never touches
// lastReadAt, currentPage, or completed.
const zoomSchema = z.object({ zoom: z.number().min(0.5).max(4) });

comicsRouter.patch(
  "/:id/zoom",
  asyncHandler(async (req, res) => {
    const parsed = zoomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ownerId = getOwnerId(req);
    const exists = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Not found" });
    await prisma.comic.update({
      where: { id: req.params.id },
      data: { lastZoom: parsed.data.zoom },
    });
    res.json({ ok: true });
  }),
);

const favoriteSchema = z.object({ favorite: z.boolean() });

comicsRouter.post(
  "/:id/favorite",
  asyncHandler(async (req, res) => {
    const parsed = favoriteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ownerId = getOwnerId(req);
    const exists = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Not found" });
    await prisma.comic.update({ where: { id: req.params.id }, data: { isFavorite: parsed.data.favorite } });
    await evaluateAchievements(ownerId);
    res.json({ ok: true });
  }),
);

const categorySchema = z.object({ category: z.string().nullable() });

comicsRouter.post(
  "/:id/category",
  asyncHandler(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ownerId = getOwnerId(req);
    const exists = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Not found" });
    await prisma.comic.update({ where: { id: req.params.id }, data: { category: parsed.data.category } });
    res.json({ ok: true });
  }),
);
