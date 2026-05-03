import path from "node:path";
import { cbzExtractor } from "./extractors/cbz";
import { cbrExtractor } from "./extractors/cbr";
import { pdfExtractor } from "./extractors/pdf";
import { folderExtractor } from "./extractors/folder";
import type { Extractor } from "./extractors/types";

export type ComicFormat = "cbz" | "cbr" | "pdf" | "folder";

export function detectFormat(filePath: string, isDirectory: boolean): ComicFormat | null {
  if (isDirectory) return "folder";
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".cbz" || ext === ".zip") return "cbz";
  if (ext === ".cbr" || ext === ".rar") return "cbr";
  if (ext === ".pdf") return "pdf";
  return null;
}

export function getExtractor(format: ComicFormat): Extractor {
  switch (format) {
    case "cbz":
      return cbzExtractor;
    case "cbr":
      return cbrExtractor;
    case "pdf":
      return pdfExtractor;
    case "folder":
      return folderExtractor;
  }
}
