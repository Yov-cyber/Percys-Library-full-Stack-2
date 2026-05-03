import clsx from "clsx";
import type { NextComic } from "../../lib/api";

interface Props {
  next: NextComic | null;
  visible: boolean;
  uiVisible: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * Discrete floating panel that appears at the end of a comic with the
 * next-in-series candidate. Stays out of the way (bottom-right, low
 * z-index just above the overlay) and respects the reader's idle-hide
 * state so it disappears together with the rest of the chrome.
 */
export function NextComicPrompt({ next, visible, uiVisible, onOpen, onDismiss }: Props) {
  if (!next || !visible) return null;
  return (
    <div
      className={clsx(
        "reader-overlay pointer-events-auto absolute bottom-28 right-4 z-30 max-w-xs rounded-xl bg-ink-800/95 p-3 shadow-soft ring-1 ring-ink-700 backdrop-blur",
        uiVisible ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-label="Siguiente cómic en la serie"
    >
      <div className="text-[11px] uppercase tracking-wide text-ink-300">Siguiente</div>
      <div className="mt-1 truncate text-sm text-ink-50" title={next.title}>
        {next.title}
      </div>
      <div className="mt-0.5 text-xs text-ink-300">{next.pageCount} pág.</div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={onOpen} className="pl-btn-primary !px-3 !py-1.5 text-xs">
          Abrir
        </button>
        <button onClick={onDismiss} className="pl-btn !bg-ink-700/80 !px-3 !py-1.5 text-xs">
          Después
        </button>
      </div>
    </div>
  );
}
