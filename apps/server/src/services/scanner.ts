import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { prisma } from "../db";
import { detectFormat, getExtractor, type ComicFormat } from "./pipeline";
import { isImageName } from "../lib/natural-sort";

async function isFolderComic(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.some((e) => e.isFile() && isImageName(e.name));
  } catch {
    return false;
  }
}

async function collectFolderImages(dir: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && isImageName(entry.name)) {
        found.push(fullPath);
      }
    }
  }
  await walk(dir);
  return found;
}

async function folderSizeBytes(dir: string): Promise<bigint> {
  try {
    const entries = await collectFolderImages(dir);
    let total = 0n;
    for (const filePath of entries) {
      try {
        const stat = await fs.stat(filePath);
        total += BigInt(stat.size);
      } catch {
        // ignore individual file errors
      }
    }
    return total;
  } catch {
    return 0n;
  }
}

async function computeSizeBytes(p: string, fmt: ComicFormat): Promise<bigint> {
  if (fmt === "folder") return folderSizeBytes(p);
  try {
    const stat = await fs.stat(p);
    return BigInt(stat.size);
  } catch {
    return 0n;
  }
}

interface ScanResult {
  added: number;
  removed: number;
  total: number;
}

// Module-level lock so the startup background scan and a user-triggered
// POST /api/library/scan never race. Concurrent callers piggyback on the
// in-flight scan instead of starting a duplicate traversal that would
// hit unique-constraint violations on `Comic.path`.
const inFlightByOwner = new Map<string, Promise<ScanResult>>();

export function scanLibrary(ownerId = "default"): Promise<ScanResult> {
  const existing = inFlightByOwner.get(ownerId);
  if (existing) return existing;
  const next = runScan(ownerId).finally(() => {
    inFlightByOwner.delete(ownerId);
  });
  inFlightByOwner.set(ownerId, next);
  return next;
}

async function runScan(ownerId: string): Promise<ScanResult> {
  const root = config.libraryPath;
  await fs.mkdir(root, { recursive: true });

  const seen = new Set<string>();
  let added = 0;

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          const isFolder = await isFolderComic(fullPath);
          if (isFolder) {
            await register(fullPath, "folder");
          } else {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const fmt = detectFormat(entry.name, false);
          if (fmt) {
            await register(fullPath, fmt);
          }
        }
      } catch (err) {
        console.warn(`[scanner] skipping ${fullPath}:`, err);
      }
    }
  }

  async function register(p: string, fmt: ComicFormat): Promise<boolean> {
    const result = await registerComicPath(ownerId, p, fmt);
    if (result === "added") added += 1;
    if (result !== "skipped") seen.add(p);
    return result !== "skipped";
  }

  await walk(root);

  // Remove DB rows for comics that no longer exist on disk
  // (including _uploads since we now scan that folder too)
  const all = (await prisma.comic.findMany({
    where: { ownerId },
    select: { id: true, path: true },
  })) as Array<{ id: string; path: string }>;
  const missing = all.filter(
    (c) => !seen.has(c.path),
  );
  if (missing.length) {
    await prisma.comic.deleteMany({
      where: { id: { in: missing.map((m) => m.id) } },
    });
  }

  const total = await prisma.comic.count({ where: { ownerId } });
  return { added, removed: missing.length, total };
}

/**
 * Delete files inside `_uploads/` that have no corresponding DB row.
 * These are leftovers from prior versions where bulk-delete or upload
 * deduplication failed to clean up properly. Older files only — recent
 * files might be uploads still being processed.
 *
 * Returns the number of orphaned files removed.
 */
export async function cleanupUploadOrphans(
  options: { minAgeMs?: number } = {},
): Promise<number> {
  const minAgeMs = options.minAgeMs ?? 60_000; // 1 minute default
  const uploadsDir = path.join(config.libraryPath, "_uploads");
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(uploadsDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  if (entries.length === 0) return 0;

  const fullPaths = entries
    .filter((e) => e.isFile() || e.isDirectory())
    .map((e) => path.join(uploadsDir, e.name));

  const known = await prisma.comic.findMany({
    where: { path: { in: fullPaths } },
    select: { path: true },
  });
  const knownSet = new Set(known.map((k: { path: string }) => k.path));

  const now = Date.now();
  let removed = 0;
  for (const p of fullPaths) {
    if (knownSet.has(p)) continue;
    try {
      const stat = await fs.stat(p);
      if (now - stat.mtimeMs < minAgeMs) continue;
      if (stat.isDirectory()) {
        await fs.rm(p, { recursive: true, force: true });
      } else {
        await fs.unlink(p);
      }
      removed += 1;
    } catch {
      // ignore individual failures
    }
  }
  return removed;
}

/**
 * Register a single comic path (file or folder) for a given owner without
 * touching unrelated rows. Used by the upload endpoint so importing a new
 * file doesn't drag previously-deleted-but-still-on-disk siblings back
 * into the library via a full re-scan.
 *
 * Returns `"added"` if a new row was created, `"updated"` if an existing
 * row was refreshed, or `"skipped"` if the source is unreadable / empty.
 */
export async function registerComicPath(
  ownerId: string,
  p: string,
  fmt: ComicFormat,
): Promise<"added" | "updated" | "skipped"> {
  // Verify file exists before attempting extraction
  let exists = false;
  try {
    if (fmt === "folder") {
      exists = await fs.stat(p).then(s => s.isDirectory());
    } else {
      exists = await fs.stat(p).then(s => s.isFile());
    }
  } catch {
    exists = false;
  }
  if (!exists) {
    console.warn(`[scanner] path does not exist: ${p}`);
    return "skipped";
  }

  let pageCount = 0;
  try {
    pageCount = await getExtractor(fmt).count(p);
  } catch (err) {
    console.warn(`[scanner] could not count pages for ${p}:`, err);
  }
  // If page count fails, we still add the file (pageCount stays 0 but file is added)

  const existing = await prisma.comic.findUnique({
    where: { ownerId_path: { ownerId, path: p } },
  });
  const sizeBytes = await computeSizeBytes(p, fmt);
  const title = path.basename(p).replace(/\.(cbz|cbr|pdf|zip|rar)$/i, "");

  if (!existing) {
    await prisma.comic.create({
      data: { ownerId, path: p, title, format: fmt, pageCount, sizeBytes },
    });
    return "added";
  }

  const clampedPage = Math.min(
    Math.max(0, existing.currentPage),
    Math.max(0, pageCount - 1),
  );
  const normalizedCompleted = clampedPage >= pageCount - 1;
  await prisma.comic.update({
    where: { id: existing.id },
    data: {
      title,
      format: fmt,
      pageCount,
      sizeBytes,
      currentPage: clampedPage,
      completed: normalizedCompleted,
    },
  });
  return "updated";
}
