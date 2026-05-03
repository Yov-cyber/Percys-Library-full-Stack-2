import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import clsx from "clsx";
import { usePanZoom } from "../../hooks/usePanZoom";

interface Props {
  comicId: string;
  pageCount: number;
  current: number;
  fitMode: "fit-width" | "fit-height" | "original";
  axis: "vertical" | "horizontal-paged-stack";
  autoCrop: boolean;
  zoom: number;
  onPageChange: (n: number) => void;
  /** Optional external ref to expose the scrolling container (for auto-scroll). */
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** Pixels of vertical gap between consecutive pages. */
  pageGap?: number;
  /** Maximum width of the page strip. 0 = unbounded. */
  maxWidth?: number;
  /** Horizontal padding on either side of the page column. */
  sidePadding?: number;
  /** How many pages around the active one are kept fully decoded. */
  preloadWindow?: number;
  /** Server-side image quality tier. */
  imageQuality?: "high" | "balanced" | "fast";
}

/**
 * Continuous vertical scroll. Uses IntersectionObserver to detect the
 * page closest to the viewport center and report it back. Pages outside
 * the active preload window render as fixed-height placeholders so very
 * large mangas / manhwas don't materialise hundreds of <img> nodes at
 * once.
 */
export function ContinuousView({
  comicId,
  pageCount,
  current,
  fitMode,
  autoCrop,
  zoom,
  onPageChange,
  scrollRef,
  pageGap = 4,
  maxWidth = 1400,
  sidePadding = 0,
  preloadWindow = 3,
  imageQuality,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrappersRef = useRef<HTMLDivElement[]>([]);
  const lastScrollSet = useRef<number>(-1);
  const { wrapperRef, panX, panY, dragging, consumeClick } = usePanZoom(
    zoom,
    `${comicId}-${current}`,
  );

  // Tracks which page wrappers are currently within (or near) the
  // viewport. Combined with `preloadWindow` this drives lightweight
  // virtualization — far-away pages render as placeholders instead of
  // <img> tags so we don't pay decode cost for the entire book up-front.
  const [visiblePages, setVisiblePages] = useState<Set<number>>(
    () => new Set([current]),
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (lastScrollSet.current === current) return;
    const target = wrappersRef.current[current];
    if (target) {
      target.scrollIntoView({ block: "start", behavior: "auto" });
      lastScrollSet.current = current;
    }
  }, [comicId, current]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestRatio = 0;
        let best = current;
        // Use a functional updater so consecutive observer callbacks
        // before the next effect run see the latest set instead of the
        // stale value captured when the effect originally ran.
        setVisiblePages((prev) => {
          const next = new Set<number>(prev);
          let changedSet = false;
          for (const e of entries) {
            const idx = Number((e.target as HTMLDivElement).dataset.page);
            if (e.isIntersecting) {
              if (!next.has(idx)) {
                next.add(idx);
                changedSet = true;
              }
              if (e.intersectionRatio > bestRatio) {
                bestRatio = e.intersectionRatio;
                best = idx;
              }
            } else if (next.has(idx)) {
              next.delete(idx);
              changedSet = true;
            }
          }
          return changedSet ? next : prev;
        });
        if (bestRatio > 0 && best !== current) {
          lastScrollSet.current = best;
          onPageChange(best);
        }
      },
      // A larger rootMargin keeps neighbouring pages "warm" so quick
      // scrolls don't reveal a placeholder before the image is ready.
      {
        root: container,
        rootMargin: "400px 0px 600px 0px",
        threshold: [0, 0.4, 0.6, 0.8],
      },
    );
    wrappersRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [comicId, pageCount, current, onPageChange]);

  function fitClass(): string {
    if (fitMode === "fit-width") return "max-w-full w-full";
    if (fitMode === "fit-height") return "max-h-screen w-auto mx-auto";
    return "w-auto mx-auto";
  }

  // Pages we will fully render an <img> for: the active page +/- the
  // preload window, plus everything currently intersecting the viewport.
  const activeWindow = useMemo(() => {
    const set = new Set<number>(visiblePages);
    for (let i = -preloadWindow; i <= preloadWindow; i++) {
      const n = current + i;
      if (n >= 0 && n < pageCount) set.add(n);
    }
    return set;
  }, [visiblePages, current, preloadWindow, pageCount]);

  const wrapperStyle = useMemo(
    () => ({
      transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`,
      transformOrigin: "top center",
      gap: `${pageGap}px`,
      maxWidth: maxWidth > 0 ? `${maxWidth}px` : undefined,
      paddingLeft: `${sidePadding}px`,
      paddingRight: `${sidePadding}px`,
    }),
    [panX, panY, zoom, pageGap, maxWidth, sidePadding],
  );

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (scrollRef) scrollRef.current = el;
      }}
      className="h-full w-full overflow-y-auto overflow-x-hidden bg-black"
    >
      <div
        ref={wrapperRef}
        onClick={(e) => {
          if (consumeClick()) e.preventDefault();
        }}
        className={clsx(
          "mx-auto flex flex-col items-center py-1 will-change-transform",
          zoom > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
        )}
        style={wrapperStyle}
      >
        {Array.from({ length: pageCount }).map((_, i) => {
          const isActive = activeWindow.has(i);
          const distance = Math.abs(i - current);
          // Pages right next to the active one get fetchpriority high so the
          // browser eagerly decodes them; everything else stays low.
          const priority = distance <= 1 ? "high" : "low";
          return (
            <div
              key={i}
              data-page={i}
              ref={(el) => {
                if (el) wrappersRef.current[i] = el;
              }}
              className="w-full grid place-items-center"
              style={!isActive ? { minHeight: "60vh" } : undefined}
            >
              {isActive ? (
                <img
                  src={api.pageUrl(comicId, i, autoCrop, imageQuality)}
                  alt={`Página ${i + 1}`}
                  loading={distance <= 1 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={priority}
                  className={`reader-page-img ${fitClass()}`}
                  draggable={false}
                />
              ) : (
                <div className="w-full max-w-full" aria-hidden>
                  <div className="mx-auto h-[60vh] w-full max-w-[760px] rounded-md bg-white/[0.02] border border-white/5 grid place-items-center text-xs text-slate-600 font-bold uppercase tracking-widest">
                    Página {i + 1}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
