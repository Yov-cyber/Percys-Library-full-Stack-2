import clsx from "clsx";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { usePanZoom } from "../../hooks/usePanZoom";

interface Props {
  comicId: string;
  page: number;
  fitMode: "fit-width" | "fit-height" | "original";
  zoom: number;
  rtl: boolean;
  autoCrop: boolean;
  axis: "horizontal" | "vertical";
  onClickZone: (zone: "prev" | "next" | "ui") => void;
  onLoaded?: () => void;
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
  imageQuality?: "high" | "balanced" | "fast";
}

export function PagedView({ comicId, page, fitMode, zoom, rtl, autoCrop, axis, onClickZone, onLoaded, scrollRef, imageQuality }: Props) {
  const [loading, setLoading] = useState(true);
  const { wrapperRef, panX, panY, dragging, consumeClick } = usePanZoom(zoom, page);

  useEffect(() => {
    setLoading(true);
  }, [comicId, page]);

  function fitClass(): string {
    if (fitMode === "fit-width") return "max-w-full max-h-none w-auto h-auto";
    if (fitMode === "fit-height") return "max-h-full max-w-none h-full w-auto";
    return "w-auto h-auto"; // original
  }

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={(e) => {
        if (scrollRef) scrollRef.current = e.currentTarget;
      }}
      onClick={(e) => {
        // If the user just finished a drag, swallow the click so it
        // doesn't double as a page-turn.
        if (consumeClick()) {
          e.preventDefault();
          return;
        }
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        if (axis === "vertical") {
          // Vertical paging: top zone = prev, bottom zone = next.
          // RTL doesn't flip the vertical axis (manga-style still reads top→bottom).
          const y = e.clientY - rect.top;
          const ratio = y / rect.height;
          if (ratio < 0.33) onClickZone("prev");
          else if (ratio > 0.66) onClickZone("next");
          else onClickZone("ui");
          return;
        }
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
          "grid place-items-center will-change-transform",
          // Skip the transform transition while dragging so pan tracks
          // the cursor 1:1; keep it for zoom changes for a smoother feel.
          !dragging && "transition-transform duration-200",
        )}
        style={{ transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})` }}
      >
        <img
          key={`${comicId}-${page}`}
          src={api.pageUrl(comicId, page, autoCrop, imageQuality)}
          alt={`Página ${page + 1}`}
          draggable={false}
          onLoad={() => {
            setLoading(false);
            onLoaded?.();
          }}
          className={clsx("reader-page-img object-contain transition-opacity duration-200", fitClass(), loading ? "opacity-0" : "opacity-100")}
        />
      </div>
      {loading && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-500 border-t-accent" />
        </div>
      )}
    </div>
  );
}
