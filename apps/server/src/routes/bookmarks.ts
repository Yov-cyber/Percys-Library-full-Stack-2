import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asyncHandler } from "../lib/async-handler";
import { getOwnerId } from "../lib/owner";

export const bookmarksRouter = Router();

const createSchema = z.object({
  page: z.number().int().nonnegative(),
  note: z.string().max(280).optional(),
});

/** List bookmarks for a comic, oldest-first so the UI shows them in
 *  reading order. */
bookmarksRouter.get(
  "/comics/:id/bookmarks",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const items = await prisma.bookmark.findMany({
      where: { ownerId, comicId: req.params.id },
      orderBy: [{ page: "asc" }, { createdAt: "asc" }],
    });
    res.json({ items });
  }),
);

bookmarksRouter.post(
  "/comics/:id/bookmarks",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const comic = await prisma.comic.findFirst({ where: { id: req.params.id, ownerId } });
    if (!comic) return res.status(404).json({ error: "Not found" });
    // Clamp page to the comic's range so a stale UI can't write garbage.
    const page = Math.max(0, Math.min(parsed.data.page, Math.max(0, comic.pageCount - 1)));
    const created = await prisma.bookmark.create({
      data: { ownerId, comicId: comic.id, page, note: parsed.data.note ?? null },
    });
    res.json({ bookmark: created });
  }),
);

bookmarksRouter.delete(
  "/bookmarks/:bid",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    // Pre-check so a missing bookmark surfaces as 404 rather than the
    // P2025 thrown by prisma.delete bubbling up as a 500.
    const existing = await prisma.bookmark.findFirst({ where: { id: req.params.bid, ownerId } });
    if (!existing) return res.status(404).json({ error: "Bookmark not found" });
    await prisma.bookmark.delete({ where: { id: req.params.bid } });
    res.json({ ok: true });
  }),
);
