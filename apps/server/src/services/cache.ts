import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { LRUCache } from "lru-cache";
import { config } from "../config";

const memCache = new LRUCache<string, Buffer>({
  max: config.pageMemoryCacheItems,
  maxSize: 256 * 1024 * 1024,
  sizeCalculation: (buf) => buf.length,
});

function hashKey(parts: string[]): string {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export const cache = {
  mem: memCache,

  async readDisk(bucket: string, key: string): Promise<Buffer | null> {
    const file = path.join(config.cacheDir, bucket, key);
    try {
      return await fs.readFile(file);
    } catch {
      return null;
    }
  },

  async writeDisk(bucket: string, key: string, data: Buffer): Promise<void> {
    const dir = path.join(config.cacheDir, bucket);
    await ensureDir(dir);
    await fs.writeFile(path.join(dir, key), data);
  },

  pageKey(comicId: string, index: number, suffix = "raw"): string {
    return `${hashKey([comicId, String(index), suffix])}.bin`;
  },

  thumbKey(comicId: string, index: number): string {
    return `${hashKey([comicId, String(index)])}.webp`;
  },

  coverKey(comicId: string): string {
    return `${hashKey([comicId, "cover"])}.webp`;
  },

  async pruneBucket(bucket: string, maxBytes: number) {
    const dir = path.join(config.cacheDir, bucket);
    let entries: { name: string; size: number; atime: number }[] = [];
    try {
      const names = await fs.readdir(dir);
      for (const name of names) {
        const stat = await fs.stat(path.join(dir, name));
        entries.push({ name, size: stat.size, atime: stat.atimeMs });
      }
    } catch {
      return;
    }
    let total = entries.reduce((acc, e) => acc + e.size, 0);
    if (total <= maxBytes) return;
    entries = entries.sort((a, b) => a.atime - b.atime);
    for (const e of entries) {
      if (total <= maxBytes) break;
      try {
        await fs.unlink(path.join(dir, e.name));
        total -= e.size;
      } catch {
        // ignore
      }
    }
  },
};
