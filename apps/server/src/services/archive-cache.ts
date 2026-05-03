import { LRUCache } from "lru-cache";

/**
 * Caches the list of pages (names/entries) for each comic file/folder.
 * This prevents reading the entire central directory of a ZIP/RAR or 
 * doing a readdir() on every single page request.
 */
export const archiveCache = new LRUCache<string, any>({
  max: 100, // Cache up to 100 recently opened comics
  ttl: 1000 * 60 * 60, // 1 hour
  dispose: (value) => {
    // If it's a PDF document, destroy it to free memory
    if (value && typeof value.destroy === "function") {
      value.destroy().catch(() => {});
    }
  }
});
