import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ComicSummary } from "../lib/api";
import { api } from "../lib/api";

interface Props {
  comic: ComicSummary;
  size?: "sm" | "md" | "lg";
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** When true, clicking the cover toggles selection instead of navigating. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const sizeMap = {
  sm: "w-[140px]",
  md: "w-[180px]",
  lg: "w-[220px]",
};

export function CoverCard({
  comic,
  size = "md",
  onToggleFavorite,
  onDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const [coverState, setCoverState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const retryTimerRef = useRef<number | null>(null);
  const progress = comic.pageCount > 0 ? Math.round((comic.currentPage / Math.max(1, comic.pageCount - 1)) * 100) : 0;
  const coverUrl = `${api.coverUrl(comic.id)}?v=${encodeURIComponent(comic.updatedAt)}${retry > 0 ? `&retry=${retry}` : ""}`;
  const titleInitials = useMemo(
    () =>
      comic.title
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => Array.from(part)[0] ?? "")
        .join("")
        .toUpperCase() || "PL",
    [comic.title],
  );

  useEffect(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setCoverState("loading");
    setRetry(0);
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [comic.id, comic.updatedAt]);

  const coverInner = (
    <>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-ink-800 via-ink-900 to-black p-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-lg font-black text-white shadow-inner">
          {titleInitials}
        </div>
        <div className="line-clamp-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {coverState === "error" ? "Portada no disponible" : "Cargando portada"}
        </div>
      </div>
      {coverState !== "ready" && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent">
          <div className="absolute inset-x-5 bottom-5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={clsx(
                "h-full rounded-full bg-blue-500/70",
                coverState === "loading" ? "w-2/3 animate-pulse" : "w-full bg-amber-400/70",
              )}
            />
          </div>
        </div>
      )}
      <img
        src={coverUrl}
        alt={comic.title}
        loading="eager"
        decoding="async"
        className={clsx(
          "h-full w-full object-cover transition-opacity duration-300",
          coverState === "ready" ? "opacity-100" : "opacity-0",
        )}
        onError={(e) => {
          if (retry < 2) {
            if (retryTimerRef.current !== null) {
              window.clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              setRetry((n) => n + 1);
            }, 350 * (retry + 1));
            return;
          }
          (e.currentTarget as HTMLImageElement).removeAttribute("src");
          setCoverState("error");
        }}
        onLoad={(e) => {
          if ((e.currentTarget as HTMLImageElement).naturalWidth > 0) {
            if (retryTimerRef.current !== null) {
              window.clearTimeout(retryTimerRef.current);
              retryTimerRef.current = null;
            }
            setCoverState("ready");
          }
        }}
      />
      {coverState === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 p-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-lg font-black text-white">
            {titleInitials}
          </div>
          <div className="line-clamp-3 text-xs font-bold text-slate-200">{comic.title}</div>
        </div>
      )}
      {comic.completed && (
        <div className="absolute top-2 left-2 rounded-md bg-emerald-500/90 px-2 py-0.5 text-xs font-medium text-white">
          Leído
        </div>
      )}
    </>
  );

  return (
    <div className={clsx("group relative animate-fade-in", sizeMap[size])}>
      {selectable ? (
        <button
          type="button"
          onClick={() => onToggleSelect?.(comic.id)}
          className={clsx(
            "relative block aspect-[2/3] w-full overflow-hidden rounded-xl bg-slate-900 ring-1 transition-all duration-300 ease-out",
            selected
              ? "ring-2 ring-blue-500 shadow-2xl shadow-blue-500/20 scale-[1.02]"
              : "ring-white/5 shadow-xl hover:ring-blue-500/40 hover:scale-[1.02] hover:-translate-y-1",
          )}
          aria-pressed={selected}
          aria-label={selected ? `Quitar selección de ${comic.title}` : `Seleccionar ${comic.title}`}
        >
          {coverInner}
          <span
            aria-hidden
            className={clsx(
              "absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-lg border text-[11px] font-bold backdrop-blur-md transition-all",
              selected
                ? "bg-blue-600 text-white border-blue-400 scale-110"
                : "bg-black/40 text-white border-white/20 opacity-0 group-hover:opacity-100",
            )}
          >
            {selected ? "✓" : ""}
          </span>
        </button>
      ) : (
        <Link
          to={`/read/${comic.id}`}
          className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-slate-900 ring-1 ring-white/5 shadow-xl transition-all duration-300 ease-out group-hover:scale-[1.03] group-hover:-translate-y-1 group-hover:ring-blue-500/40 group-hover:shadow-2xl group-hover:shadow-blue-500/10"
        >
          {coverInner}
        </Link>
      )}
      {!selectable && (
        <button
          onClick={(e) => { e.preventDefault(); onToggleFavorite?.(comic.id); }}
          className={clsx(
            "absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-xl backdrop-blur-md transition-all duration-300",
            comic.isFavorite 
              ? "bg-amber-400 text-slate-950 scale-100 shadow-lg shadow-amber-400/20" 
              : "bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60",
          )}
          aria-label={comic.isFavorite ? "Quitar de favoritos" : "Marcar favorito"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={comic.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <path d="M12 2.5l3 6.5 7 .9-5.2 4.7 1.5 7-6.3-3.6-6.3 3.6 1.5-7L2 9.9l7-.9z" />
          </svg>
        </button>
      )}
      {!selectable && onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); onDelete(comic.id); }}
          className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-xl bg-black/50 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 hover:bg-red-600"
          aria-label="Eliminar de biblioteca"
          title="Eliminar de biblioteca"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      )}
      <div className="mt-3 px-1">
        <div className="truncate text-sm font-semibold text-slate-100 leading-tight group-hover:text-blue-400 transition-colors" title={comic.title}>
          {comic.title}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {comic.format} · {comic.pageCount}P
          </div>
          {comic.currentPage > 0 && !comic.completed && (
            <span className="text-[10px] font-bold text-blue-500/80">{progress}%</span>
          )}
        </div>
        {comic.currentPage > 0 && !comic.completed && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
