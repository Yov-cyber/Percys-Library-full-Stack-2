import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import multer from "multer";
import { prisma } from "../db";
import { config } from "../config";
import { scanLibrary, registerComicPath } from "../services/scanner";
import { detectFormat, type ComicFormat } from "../services/pipeline";
import { asyncHandler } from "../lib/async-handler";
import { getOwnerId } from "../lib/owner";
import { isImageName } from "../lib/natural-sort";

export const libraryRouter = Router();

const ALLOWED_EXT = new Set([".cbz", ".cbr", ".pdf", ".zip", ".rar"]);
const ALLOWED_IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
]);
// 2 GB hard cap per file. Realistic comic archives sit well below this; we
// still bound it to avoid accidental DoS via a single huge upload.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const IMAGE_EXT_PATTERN = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;
const COMIC_EXT_PATTERN = /\.(cbz|cbr|pdf|zip|rar|jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;

function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(COMIC_EXT_PATTERN, "")
    .replace(/-\w{4,}$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fileSignature(filePath: string): Promise<string> {
  const stat = await fsp.stat(filePath);
  const handle = await fsp.open(filePath, "r");
  try {
    const length = Math.min(64 * 1024, Number(stat.size));
    const buf = Buffer.alloc(length);
    await handle.read(buf, 0, length, 0);
    return `${stat.size}:${buf.toString("base64")}`;
  } finally {
    await handle.close();
  }
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
      const original = Buffer.from(file.originalname, "latin1").toString("utf8");
      file.originalname = original;
      const ext = path.extname(original).toLowerCase();
      const base = path
        .basename(original)
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 200);
      const stem = path.basename(base, ext);
      const stamp = Date.now().toString(36);
      cb(null, `${stem}-${stamp}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext) && !ALLOWED_IMAGE_EXT.has(ext)) {
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
      select: { title: true, path: true, sizeBytes: true },
    });
    const existingTitles = new Set(existing.map((c) => normalizeTitle(c.title)));
    const existingSignatures = new Set<string>();
    for (const comic of existing) {
      try {
        if (Number(comic.sizeBytes) > 0) {
          existingSignatures.add(await fileSignature(comic.path));
        }
      } catch {
        // ignore stale or inaccessible files; the scanner reconciles them
      }
    }
    const seenBatch = new Set<string>();
    const seenSignatures = new Set<string>();
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
      let sig = "";
      try {
        sig = await fileSignature(file.path);
      } catch {
        sig = "";
      }
      if (sig && existingSignatures.has(sig)) {
        skipped.push({ name: file.originalname, reason: "already-exists" });
        void fs.promises.unlink(file.path).catch(() => undefined);
        continue;
      }
      if (sig && seenSignatures.has(sig)) {
        skipped.push({ name: file.originalname, reason: "duplicated-in-batch" });
        void fs.promises.unlink(file.path).catch(() => undefined);
        continue;
      }
      seenBatch.add(key);
      if (sig) seenSignatures.add(sig);
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
    const imageGroups = new Map<string, Express.Multer.File[]>();
    const archives: Express.Multer.File[] = [];
    for (const file of accepted) {
      if (isImageName(file.originalname)) {
        const group = path.dirname(file.originalname);
        imageGroups.set(group, [...(imageGroups.get(group) ?? []), file]);
      } else {
        archives.push(file);
      }
    }

    const sources: { sourcePath: string; fmt: ComicFormat; files: Express.Multer.File[] }[] = [];
    let unreadable = 0;
    for (const file of archives) {
      const fmt = detectFormat(file.path, false);
      if (!fmt) {
        unreadable += 1;
        void fs.promises.unlink(file.path).catch(() => undefined);
        continue;
      }
      sources.push({ sourcePath: file.path, fmt, files: [file] });
    }
    for (const [group, groupFiles] of imageGroups) {
      const seedName = group === "." ? groupFiles[0]?.originalname ?? "comic" : group;
      const title = path.basename(seedName).replace(IMAGE_EXT_PATTERN, "") || "comic";
      const dir = path.join(config.libraryPath, "_uploads", `${title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120)}-${Date.now().toString(36)}`);
      await fsp.mkdir(dir, { recursive: true });
      for (const file of groupFiles) {
        await fsp.rename(file.path, path.join(dir, path.basename(file.originalname).replace(/[\\/:*?"<>|]/g, "_")));
      }
      sources.push({ sourcePath: dir, fmt: "folder", files: groupFiles });
    }

    let added = 0;
    let registered = 0;
    const uploadedNames = new Set<string>();
    for (const source of sources) {
      try {
        const result = await registerComicPath(ownerId, source.sourcePath, source.fmt);
        if (result === "added") added += 1;
        if (result !== "skipped") {
          registered += 1;
          for (const file of source.files) uploadedNames.add(file.originalname);
        }
        if (result === "skipped") {
          unreadable += 1;
          void fs.promises.rm(source.sourcePath, { recursive: true, force: true }).catch(() => undefined);
        }
      } catch (err) {
        // Best-effort: skip the file but keep going so one bad upload
        // doesn't sink the whole batch.
        console.error("Failed to register uploaded comic", source.sourcePath, err);
        unreadable += 1;
        void fs.promises.rm(source.sourcePath, { recursive: true, force: true }).catch(() => undefined);
      }
    }
    const total = await prisma.comic.count({ where: { ownerId } });
    res.json({
      uploaded: accepted
        .filter((f) => uploadedNames.has(f.originalname))
        .map((f) => ({ name: f.originalname, size: f.size })),
      skipped,
      added,
      registered,
      unreadable,
      removed: 0,
      total,
    });
  }),
);
