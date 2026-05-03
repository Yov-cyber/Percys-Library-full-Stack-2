import fs from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { archiveCache } from "../archive-cache";
import type { Extractor, PageRef } from "./types";

// pdfjs-dist legacy build runs in plain Node.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs: any = require("pdfjs-dist/legacy/build/pdf.js");

async function getPdfMetadata(filePath: string) {
  const cacheKey = `metadata:pdf:${filePath}`;
  const cached = archiveCache.get(cacheKey);
  if (cached) return cached;

  const data = await fs.readFile(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  await doc.destroy(); // Free memory immediately after getting metadata

  archiveCache.set(cacheKey, numPages);
  return numPages;
}

async function getDocInstance(filePath: string) {
  // We don't cache the full document instance anymore because it holds onto
  // a large buffer. We load it on-demand for page rendering.
  const data = await fs.readFile(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  return loadingTask.promise;
}

export const pdfExtractor: Extractor = {
  async count(filePath) {
    try {
      return getPdfMetadata(filePath);
    } catch (err) {
      console.error(`[pdf] count failed for ${filePath}:`, err);
      return 0;
    }
  },
  async list(filePath): Promise<PageRef[]> {
    try {
      const numPages = await getPdfMetadata(filePath);
      const refs: PageRef[] = [];
      for (let i = 0; i < numPages; i++) refs.push({ index: i, name: `page-${i + 1}.png` });
      return refs;
    } catch (err) {
      console.error(`[pdf] list failed for ${filePath}:`, err);
      return [];
    }
  },
  async page(filePath, index) {
    try {
      const doc = await getDocInstance(filePath);
      try {
        const page = await doc.getPage(index + 1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx as any, viewport }).promise;
        return canvas.toBuffer("image/png");
      } finally {
        await doc.destroy();
      }
    } catch (err) {
      console.error(`[pdf] page ${index} failed for ${filePath}:`, err);
      throw err;
    }
  },
};
