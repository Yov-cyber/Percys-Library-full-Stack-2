import fs from "node:fs/promises";
import path from "node:path";
import { naturalCompare, isImageName } from "../../lib/natural-sort";
import { archiveCache } from "../archive-cache";
import type { Extractor, PageRef } from "./types";

async function getFolder(dir: string) {
  const cached = archiveCache.get(dir);
  if (cached) return cached;

  const names: string[] = [];
  async function walk(current: string, prefix = "") {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else if (entry.isFile() && isImageName(entry.name)) {
        names.push(rel);
      }
    }
  }
  await walk(dir);
  names.sort(naturalCompare);
  
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
