import { prisma } from "../db";
import { cache } from "./cache";
import { getExtractor, type ComicFormat } from "./pipeline";
import { autoCropWhiteMargins, detectMime, makeThumbnail, recompressForQuality } from "../lib/image-utils";
import { config } from "../config";

export interface PageBlob {
  data: Buffer;
  mime: string;
}

export type ImageQuality = "high" | "balanced" | "fast";

export async function getPage(
  comicId: string,
  index: number,
  opts: { autoCrop?: boolean; quality?: ImageQuality } = {},
): Promise<PageBlob | null> {
  const quality: ImageQuality = opts.quality ?? "balanced";
  // Cache key includes the quality tier so different tiers don't shadow
  // each other on disk; sharing entries between tiers would force every
  // visitor to wait for whichever variant happened to be cached first.
  const variant = `${opts.autoCrop ? "crop" : "raw"}-${quality}`;
  const memKey = `${comicId}:${index}:${variant}`;
  const memHit = cache.mem.get(memKey);
  if (memHit) return { data: memHit, mime: detectMime(memHit) };

  const diskKey = cache.pageKey(comicId, index, variant);
  const diskHit = await cache.readDisk("pages", diskKey);
  if (diskHit) {
    cache.mem.set(memKey, diskHit);
    return { data: diskHit, mime: detectMime(diskHit) };
  }

  const comic = await prisma.comic.findUnique({ where: { id: comicId } });
  if (!comic) return null;
  const extractor = getExtractor(comic.format as ComicFormat);
  let buf: Buffer;
  try {
    buf = await extractor.page(comic.path, index);
  } catch {
    return null;
  }

  if (opts.autoCrop) {
    try {
      buf = await autoCropWhiteMargins(buf);
    } catch {
      // fall back to original
    }
  }

  if (quality !== "high") {
    buf = await recompressForQuality(buf, quality);
  }

  cache.mem.set(memKey, buf);
  await cache.writeDisk("pages", diskKey, buf);
  await cache.pruneBucket("pages", 1024 * 1024 * 1024);
  return { data: buf, mime: detectMime(buf) };
}

export async function getThumb(comicId: string, index: number): Promise<Buffer | null> {
  const key = cache.thumbKey(comicId, index);
  const diskHit = await cache.readDisk("thumbs", key);
  if (diskHit) return diskHit;

  // Always derive thumbnails from the original (high) page so we don't
  // stack two lossy passes (recompress -> resize). The page tier the user
  // chose only affects in-reader delivery, not the cached thumbnail.
  const page = await getPage(comicId, index, { quality: "high" });
  if (!page) return null;
  let thumb: Buffer;
  try {
    thumb = await makeThumbnail(page.data, config.thumbWidth);
  } catch {
    return null;
  }
  await cache.writeDisk("thumbs", key, thumb);
  await cache.pruneBucket("thumbs", 256 * 1024 * 1024);
  return thumb;
}
