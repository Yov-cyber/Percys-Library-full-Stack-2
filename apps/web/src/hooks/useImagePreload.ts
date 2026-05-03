import { useEffect, useRef } from "react";

/**
 * Pre-fetch nearby pages so transitions feel instant. Holds onto the
 * created Image objects until they fall out of the active window so the
 * browser can keep them in cache without retaining giant decoded buffers.
 */
export function useImagePreload(urls: string[]) {
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    const cache = cacheRef.current;
    const wanted = new Set(urls);
    for (const url of urls) {
      if (!cache.has(url)) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        cache.set(url, img);
      }
    }
    for (const url of [...cache.keys()]) {
      if (!wanted.has(url)) {
        cache.delete(url);
      }
    }
  }, [urls]);
}
