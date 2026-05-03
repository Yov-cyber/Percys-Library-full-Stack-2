import fs from "node:fs/promises";
import path from "node:path";
import { naturalCompare, isImageName } from "../../lib/natural-sort";
import { archiveCache } from "../archive-cache";
import type { Extractor, PageRef } from "./types";

async function getFolder(dir: string) {
  const cached = archiveCache.get(dir);
  if (cached) return cached;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const names = entries
    .filter((e) => e.isFile() && isImageName(e.name))
    .map((e) => e.name)
    .sort(naturalCompare);
  
  archiveCache.set(dir, names);
  return names;
}

export const folderExtractor: Extractor = {
  async count(dir) {
    try {
      const names = await getFolder(dir);
      return names.length;
    } catch (err) {
      console.error(`[folder] count failed for ${dir}:`, err);
      return 0;
    }
  },
  async list(dir): Promise<PageRef[]> {
    try {
      const names = await getFolder(dir);
      return names.map((name: string, i: number) => ({ index: i, name }));
    } catch (err) {
      console.error(`[folder] list failed for ${dir}:`, err);
      return [];
    }
  },
  async page(dir, index) {
    try {
      const names = await getFolder(dir);
      const name = names[index];
      if (!name) throw new Error(`Page ${index} not found in folder`);
      return fs.readFile(path.join(dir, name));
    } catch (err) {
      console.error(`[folder] page ${index} failed for ${dir}:`, err);
      throw err;
    }
  },
};
