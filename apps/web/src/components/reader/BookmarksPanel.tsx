import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type BookmarkDto } from "../../lib/api";
import { useToasts } from "../../stores/toasts";

interface Props {
  comicId: string;
  open: boolean;
  currentPage: number;
  pageCount: number;
  onClose: () => void;
  onJump: (page: number) => void;
}

/**
 * Side-panel listing bookmarks for the current comic. The panel itself is
 * the only screen real estate dedicated to bookmarks — the reader top bar
 * just gets a tiny toggle button. Adding the current page is one click;
 * notes are optional and edited in-place.
 */
export function BookmarksPanel({ comicId, open, currentPage, pageCount, onClose, onJump }: Props) {
  const [items, setItems] = useState<BookmarkDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const push = useToasts((s) => s.push);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api
      .bookmarks(comicId)
      .then((r) => !cancelled && setItems(r.items))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, comicId]);

  async function add() {
    const trimmed = note.trim();
    const r = await api.addBookmark(comicId, currentPage, trimmed || undefined);
    setItems((arr) => [...arr, r.bookmark].sort((a, b) => a.page - b.page));
    setNote("");
    push("Marcador añadido", "success");
  }

  async function remove(bid: string) {
    await api.deleteBookmark(bid);
    setItems((arr) => arr.filter((b) => b.id !== bid));
  }

  return (
    <aside
      className={clsx(
        "absolute right-0 top-0 z-30 h-full w-80 max-w-[90vw] transform border-l border-ink-800/60 bg-ink-900/95 backdrop-blur-sm transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
      aria-hidden={!open}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-ink-800/60">
        <h2 className="text-sm font-medium text-ink-100">Marcadores</h2>
        <button
          onClick={onClose}
          aria-label="Cerrar marcadores"
          className="rounded-md px-2 py-1 text-xs text-ink-300 hover:bg-ink-800"
        >
          ✕
        </button>
      </header>

      <div className="space-y-2 px-4 py-3 border-b border-ink-800/60">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Nota (opcional) — pág. ${currentPage + 1}`}
          maxLength={280}
          className="w-full rounded-md bg-ink-800 border border-ink-700/60 px-2 py-1.5 text-xs text-ink-100 placeholder:text-ink-400 focus:outline-none focus:border-accent"
        />
        <button onClick={add} className="pl-btn-primary w-full !py-1.5 text-xs">
          Guardar página actual
        </button>
      </div>

      <ul className="overflow-y-auto px-2 py-2 max-h-[calc(100%-7.5rem)]">
        {loading && <li className="px-2 py-3 text-xs text-ink-400">Cargando…</li>}
        {!loading && items.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-ink-400">
            Sin marcadores aún.
          </li>
        )}
        {items.map((b) => (
          <li
            key={b.id}
            className="group flex items-start gap-2 rounded-md px-2 py-2 hover:bg-ink-800/60"
          >
            <button
              onClick={() => onJump(b.page)}
              className="flex-1 text-left"
              aria-label={`Ir a página ${b.page + 1}`}
            >
              <div className="text-xs text-ink-100">
                Página {b.page + 1} <span className="text-ink-400">/ {pageCount}</span>
              </div>
              {b.note && <div className="mt-0.5 text-xs text-ink-300 line-clamp-2">{b.note}</div>}
            </button>
            <button
              onClick={() => void remove(b.id)}
              aria-label="Eliminar marcador"
              className="opacity-0 transition-opacity group-hover:opacity-100 text-xs text-ink-400 hover:text-red-400"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
