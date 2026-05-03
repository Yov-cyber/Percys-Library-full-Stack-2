import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { prisma } from "../db";
import { config } from "../config";
import { scanLibrary, registerComicPath } from "../services/scanner";
import { detectFormat } from "../services/pipeline";
import { asyncHandler } from "../lib/async-handler";
import { getOwnerId } from "../lib/owner";

export const libraryRouter = Router();

// Allow CBZ/CBR/PDF uploads only; everything else is rejected at the
// middleware level so we never write rogue files into the library.
const ALLOWED_EXT = new Set([".cbz", ".cbr", ".pdf", ".zip", ".rar"]);
// 2 GB hard cap per file. Realistic comic archives sit well below this; we
// still bound it to avoid accidental DoS via a single huge upload.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.(cbz|cbr|pdf|zip|rar)$/i, "")
    .replace(/-\w{4,}$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Drop uploads into a dedicated subfolder so accidental cleanups
      // don't blow away the user's manually-curated tree.
      const dir = path.join(config.libraryPath, "_uploads");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      // Preserve the original name but make it filesystem-safe and
      // unique within the upload dir to avoid collisions.
      const base = path
        .basename(file.originalname)
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 200);
      const ext = path.extname(base).toLowerCase();
      const stem = path.basename(base, ext);
      const stamp = Date.now().toString(36);
      cb(null, `${stem}-${stamp}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error(`Formato no soportado: ${ext || "(sin extensión)"}`));
    }
    cb(null, true);
  },
});

libraryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const comics = await prisma.comic.findMany({ where: { ownerId }, orderBy: [{ updatedAt: "desc" }] });
    res.json(
      comics.map((c: {
        id: string;
        title: string;
        format: string;
        pageCount: number;
        currentPage: number;
        completed: boolean;
        isFavorite: boolean;
        category: string | null;
        addedAt: Date;
        updatedAt: Date;
        lastReadAt: Date | null;
        sizeBytes: bigint;
        lastZoom: number | null;
      }) => ({
        id: c.id,
        title: c.title,
        format: c.format,
        pageCount: c.pageCount,
        currentPage: c.currentPage,
        completed: c.completed,
        isFavorite: c.isFavorite,
        category: c.category,
        addedAt: c.addedAt,
        updatedAt: c.updatedAt,
        lastReadAt: c.lastReadAt,
        sizeBytes: Number(c.sizeBytes),
        lastZoom: c.lastZoom,
      })),
    );
  }),
);

libraryRouter.post(
  "/scan",
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const result = await scanLibrary(ownerId);
    res.json(result);
  }),
);

// Accepts one or more comic files (CBZ / CBR / PDF). Files land under
// `<libraryPath>/_uploads/` and trigger an immediate scan so the new
// comics show up without an explicit second request.
libraryRouter.post(
  "/upload",
  (req, res, next) => {
    // multer pushes its own MulterError + filter errors through `next`. We
    // want a 400 with the human message instead of the generic 500 so the
    // upload UI can surface the cause to the user.
    upload.array("files", 50)(req, res, (err) => {
      if (!err) return next();
      const msg = err instanceof Error ? err.message : "Error subiendo archivo";
      res.status(400).json({ error: msg });
    });
  },
  asyncHandler(async (req, res) => {
    const ownerId = getOwnerId(req);
    const files = ((req.files as Express.Multer.File[] | undefined) ?? []).filter(Boolean);
    if (files.length === 0) {
      return res.status(400).json({ error: "No se enviaron archivos" });
    }

    const existing = await prisma.comic.findMany({
      where: { ownerId },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((c) => normalizeTitle(c.title)));
    const seenBatch = new Set<string>();
    const accepted: Express.Multer.File[] = [];
    const skipped: { name: string; reason: "already-exists" | "duplicated-in-batch" }[] = [];

    for (const file of files) {
      const key = normalizeTitle(file.originalname);
      if (!key) {
        accepted.push(file);
        continue;
      }
      if (existingTitles.has(key)) {
        skipped.push({ name: file.originalname, reason: "already-exists" });
        void fs.promises.unlink(file.path).catch(() => undefined);
        continue;
      }
      if (seenBatch.has(key)) {
        skipped.push({ name: file.originalname, reason: "duplicated-in-batch" });
        void fs.promises.unlink(file.path).catch(() => undefined);
        continue;
      }
      seenBatch.add(key);
      accepted.push(file);
    }

    // Register only the freshly-uploaded paths instead of running a full
    // scan over `_uploads/`. Two reasons:
    //   1. A full walk would resurrect files that were deleted from the
    //      DB but linger on disk (e.g. unlink races, manual cleanup
    //      pending), which is exactly the bug users were hitting where
    //      "old comics come back when I import a new one".
    //   2. It's much faster: parsing N new files instead of every file
    //      that has ever been uploaded.
    let added = 0;
    for (const file of accepted) {
      const fmt = detectFormat(file.path, false);
      if (!fmt) continue;
      try {
        const result = await registerComicPath(ownerId, file.path, fmt);
        if (result === "added") added += 1;
      } catch (err) {
        // Best-effort: skip the file but keep going so one bad upload
        // doesn't sink the whole batch.
        console.error("Failed to register uploaded comic", file.path, err);
      }
    }
    const total = await prisma.comic.count({ where: { ownerId } });
    res.json({
      uploaded: accepted.map((f) => ({ name: f.originalname, size: f.size })),
      skipped,
      added,
      removed: 0,
      total,
    });
  }),
);
