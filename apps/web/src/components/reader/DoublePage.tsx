import clsx from "clsx";
import { api } from "../../lib/api";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePanZoom } from "../../hooks/usePanZoom";

/** Media query that triggers the single-page fallback. Exported so the
 *  parent (Reader) can ask the same question to decide its step size. */
export const DOUBLE_PAGE_FALLBACK_QUERY = "(max-width: 700px), (orientation: portrait)";

interface Props {
  comicId: string;
  page: number;
  pageCount: number;
  fitMode: "fit-width" | "fit-height" | "original";
  zoom: number;
  rtl: boolean;
  autoCrop: boolean;
  onClickZone: (zone: "prev" | "next" | "ui") => void;
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
  imageQuality?: "high" | "balanced" | "fast";
  pageGap?: number;
}

/**
 * Double-page spread for desktop. Renders two consecutive pages side by
 * side, with the leftmost being the lower index (or higher index when
 * RTL is on, mimicking manga's right→left layout). Auto-falls back to
 * a single page when the viewport is portrait or below 700px wide so
 * mobile / tablets in portrait still get a usable single-page view.
 *
 * Click zones are identical to PagedHorizontal: left third = prev,
 * right third = next, middle = toggle UI. RTL flips them so the user
 * always clicks the "forward" side of the spread to advance. When
 * zoom > 1, drag-to-pan moves the spread within the viewport.
 */
export function DoublePage({ comicId, page, pageCount, fitMode, zoom, rtl, autoCrop, onClickZone, scrollRef, imageQuality, pageGap = 0 }: Props) {
  // The spread always pairs `page` (low index) with `page+1` (high index).
  // RTL only changes which one ends up on the *left* of the screen so the
  // reader's eye lands on the lower-index page first.
  const lowIdx = page;
  const highIdx = Math.min(page + 1, pageCount - 1);
  const showSecond = highIdx !== lowIdx;
  const leftScreen = rtl ? highIdx : lowIdx;
  const rightScreen = rtl ? lowIdx : highIdx;

  const isPortrait = useMediaQuery(DOUBLE_PAGE_FALLBACK_QUERY);
  const { wrapperRef, panX, panY, dragging, consumeClick } = usePanZoom(zoom, page);

  function fitClass(): string {
    if (fitMode === "fit-height") return "max-h-full h-full w-auto";
    // For double-page, fit-width has to share the row, so each img caps at 50vw.
    if (fitMode === "fit-width") return "max-h-full max-w-[50vw] h-auto w-auto";
    return "h-auto w-auto";
  }

  const pages = isPortrait || !showSecond ? [page] : [leftScreen, rightScreen];

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={(e) => {
        if (scrollRef) scrollRef.current = e.currentTarget;
      }}
      onClick={(e) => {
        if (consumeClick()) {
          e.preventDefault();
          return;
        }
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = x / rect.width;
        if (ratio < 0.33) onClickZone(rtl ? "next" : "prev");
        else if (ratio > 0.66) onClickZone(rtl ? "prev" : "next");
        else onClickZone("ui");
      }}
      className={clsx(
        "relative h-full w-full overflow-auto grid place-items-center select-none",
        zoom > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
      )}
    >
      <div
        className={clsx(
          "flex h-full w-full items-center justify-center will-change-transform",
          !dragging && "transition-transform duration-200",
        )}
        style={{ transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`, gap: `${pageGap}px` }}
      >
        {pages.map((p) => (
          <img
            key={`${comicId}-${p}`}
            src={api.pageUrl(comicId, p, autoCrop, imageQuality)}
            alt={`Página ${p + 1}`}
            draggable={false}
            className={clsx("reader-page-img object-contain", fitClass())}
          />
        ))}
      </div>
    </div>
  );
}
