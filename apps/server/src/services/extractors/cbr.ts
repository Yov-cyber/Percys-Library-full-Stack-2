import fs from "node:fs/promises";
import { createExtractorFromData } from "node-unrar-js";
import AdmZip from "adm-zip";
import { naturalCompare, isImageName } from "../../lib/natural-sort";
import { archiveCache } from "../archive-cache";
import type { Extractor, PageRef } from "./types";

async function getRarMetadata(filePath: string) {
  const cacheKey = `metadata:cbr:${filePath}`;
  const cached = archiveCache.get(cacheKey);
  if (cached) return cached;

  const buf = await fs.readFile(filePath);
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  try {
    const extractor = await createExtractorFromData({ data });
    const list = extractor.getFileList();
    const files = Array.from(list.fileHeaders)
      .filter((f: any) => !f.flags.directory && !f.flags.encrypted && isImageName(f.name))
      .sort((a: any, b: any) => naturalCompare(a.name, b.name))
      .map((f: any) => ({ name: f.name }));

    archiveCache.set(cacheKey, files);
    return files;
  } catch (err: any) {
    const errMsg = String(err).toLowerCase();
    if (errMsg.includes("not rar") || errMsg.includes("bad archive")) {
      try {
        const zip = new AdmZip(buf);
        const entries = zip.getEntries();
        const files = entries
          .filter((e) => !e.isDirectory && isImageName(e.entryName))
          .sort((a, b) => naturalCompare(a.entryName, b.entryName))
          .map((e) => ({ name: e.entryName }));
        archiveCache.set(cacheKey, files);
        return files;
      } catch {
        /* ZIP fallback failed too - fall through to throw original error */
      }
    }
    throw err;
  }
}

export const cbrExtractor: Extractor = {
  async count(filePath) {
    try {
      const files = await getRarMetadata(filePath);
      return files.length;
    } catch (err) {
      console.error(`[cbr] count failed for ${filePath}:`, err);
      return 0;
    }
  },
  async list(filePath): Promise<PageRef[]> {
    try {
      const files = await getRarMetadata(filePath);
      return files.map((f: any, i: number) => ({ index: i, name: f.name }));
    } catch (err) {
      console.error(`[cbr] list failed for ${filePath}:`, err);
      return [];
    }
  },
  async page(filePath, index) {
    try {
      const files = await getRarMetadata(filePath);
      const target = files[index];
      if (!target) throw new Error(`Page ${index} not found in CBR`);

      const buf = await fs.readFile(filePath);

      try {
        const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        const extractor = await createExtractorFromData({ data });
        const extracted = extractor.extract({ files: [target.name] });
        const fileArr = [...extracted.files];
        const entry = fileArr[0];
        if (!entry || !entry.extraction) throw new Error("CBR extraction failed");
        return Buffer.from(entry.extraction);
      } catch (rarErr: any) {
        const errMsg = String(rarErr).toLowerCase();
        if (errMsg.includes("not rar") || errMsg.includes("bad archive")) {
          try {
            const zip = new AdmZip(buf);
            const entry = zip.getEntry(target.name);
            if (!entry) throw new Error(`Page ${index} not found in ZIP`);
            return entry.getData();
          } catch {
            /* ZIP fallback failed - fall through to throw original error */
          }
        }
        throw rarErr;
      }
    } catch (err) {
      console.error(`[cbr] page ${index} failed for ${filePath}:`, err);
      throw err;
    }
  },
};
