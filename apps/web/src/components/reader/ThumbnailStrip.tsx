import { useEffect, useRef } from "react";
import clsx from "clsx";
import { api } from "../../lib/api";

interface Props {
  comicId: string;
  pageCount: number;
  current: number;
  rtl: boolean;
  onSelect: (n: number) => void;
}

export function ThumbnailStrip({ comicId, pageCount, current, rtl, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLButtonElement[]>([]);

  // Lazy-load thumbs that scroll into view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLImageElement;
          if (entry.isIntersecting && !el.src) {
            const n = Number(el.dataset.page);
            el.src = api.thumbUrl(comicId, n);
            observer.unobserve(el);
          }
        }
      },
      { root: container, rootMargin: "200px" },
    );
    container.querySelectorAll<HTMLImageElement>("img[data-page]").forEach((img) => observer.observe(img));
    return () => observer.disconnect();
  }, [comicId, pageCount]);

  // Keep current thumb in view.
  useEffect(() => {
    const node = thumbsRef.current[current];
    if (node) node.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [current]);

  const items = Array.from({ length: pageCount });
  const ordered = rtl ? items.map((_, i) => pageCount - 1 - i) : items.map((_, i) => i);

  return (
    <div
      ref={containerRef}
      className="reader-overlay flex h-24 gap-1.5 overflow-x-auto overflow-y-hidden bg-ink-900/80 px-3 py-2 backdrop-blur-md"
      style={{ direction: rtl ? "rtl" : "ltr" }}
    >
      {ordered.map((i) => (
        <button
          key={i}
          ref={(el) => {
            if (el) thumbsRef.current[i] = el;
          }}
          onClick={() => onSelect(i)}
          className={clsx(
            "relative h-full aspect-[2/3] flex-shrink-0 overflow-hidden rounded-md ring-1 transition",
            current === i ? "ring-accent ring-2" : "ring-ink-700/60 opacity-70 hover:opacity-100",
          )}
        >
          <img
            data-page={i}
            alt={`Página ${i + 1}`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <span className="absolute bottom-0.5 right-1 rounded bg-black/60 px-1 text-[10px]">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
