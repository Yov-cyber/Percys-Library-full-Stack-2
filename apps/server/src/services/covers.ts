import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../db";
import { config } from "../config";
import { cache } from "./cache";
import { getExtractor, type ComicFormat } from "./pipeline";
import { folderExtractor } from "./extractors/folder";
import { detectMime, makeThumbnail, normalizeImage } from "../lib/image-utils";
import { isImageName, naturalCompare } from "../lib/natural-sort";

async function findFolderCover(dir: string): Promise<Buffer | null> {
  try {
    const entries = await fs.readdir(dir);
    const candidates = entries
      .filter((n) => /^(cover|folder|poster)\.(jpe?g|png|webp)$/i.test(n))
      .sort(naturalCompare);
    if (candidates[0]) return fs.readFile(path.join(dir, candidates[0]));
    const firstImage = entries.filter(isImageName).sort(naturalCompare)[0];
    if (firstImage) return fs.readFile(path.join(dir, firstImage));
  } catch {
    /* ignore */
  }
  return null;
}

function looksValidCover(buf: Buffer): boolean {
  return buf.length > 0;
}

async function normalizeCoverCandidate(buf: Buffer): Promise<Buffer | null> {
  try {
    const image = await normalizeImage(buf);
    return image.data;
  } catch {
    return null;
  }
}

export async function getCover(comicId: string): Promise<Buffer | null> {
  const cached = await cache.readDisk("covers", cache.coverKey(comicId));
  if (cached) return cached;

  const comic = await prisma.comic.findUnique({ where: { id: comicId } });
  if (!comic) return null;

  let raw: Buffer | null = null;
  if (comic.format === "folder") {
    raw = await findFolderCover(comic.path);
  } else {
    const extractor = getExtractor(comic.format as ComicFormat);
    const max = Math.min(comic.pageCount, 4);
    for (let i = 0; i < max; i++) {
      try {
        const candidate = await normalizeCoverCandidate(await extractor.page(comic.path, i));
        if (candidate && looksValidCover(candidate)) {
          raw = candidate;
          break;
        }
      } catch {
        continue;
      }
    }
    if (!raw && comic.pageCount > 0) {
      try {
        raw = await extractor.page(comic.path, 0);
      } catch {
        raw = null;
      }
    }
  }

  if (raw) {
    raw = await normalizeCoverCandidate(raw);
  }
  if (!raw) return null;

  let result: Buffer;
  try {
    result = await makeThumbnail(raw, config.coverWidth);
  } catch {
    if (detectMime(raw) === "application/octet-stream") return null;
    result = raw;
  }
  await cache.writeDisk("covers", cache.coverKey(comicId), result);
  await cache.pruneBucket("covers", 500 * 1024 * 1024);
  return result;
}

// Re-export for tests / future use
export const _internal = { findFolderCover, folderExtractor };
