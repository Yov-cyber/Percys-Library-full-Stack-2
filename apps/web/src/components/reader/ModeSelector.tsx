import clsx from "clsx";
import type { ReadingMode } from "../../lib/api";

interface Props {
  value: ReadingMode;
  onChange: (mode: ReadingMode) => void;
}

const MODES: { id: ReadingMode; label: string; icon: React.ReactNode }[] = [
  {
    id: "paged-h",
    label: "Paginado horizontal",
    icon: (
      // single rect — represents one page
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="6" y="4" width="12" height="16" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "paged-h-2",
    label: "Doble página",
    icon: (
      // two side-by-side rects
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="8" height="16" rx="1.2" />
        <rect x="13" y="4" width="8" height="16" rx="1.2" />
      </svg>
    ),
  },
  {
    id: "paged-v",
    label: "Paginado vertical",
    icon: (
      // single rect, hint of stacking via top dash
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="6" width="14" height="12" rx="1.5" />
        <path d="M8 3h8" />
      </svg>
    ),
  },
  {
    id: "scroll-v",
    label: "Scroll continuo",
    icon: (
      // two stacked rects with a small gap
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="6" y="3" width="12" height="8" rx="1.2" />
        <rect x="6" y="13" width="12" height="8" rx="1.2" />
      </svg>
    ),
  },
  {
    id: "webtoon",
    label: "Webtoon",
    icon: (
      // tall single strip
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="9" y="2" width="6" height="20" rx="1.2" />
      </svg>
    ),
  },
];

export function ModeSelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-ink-800/80 p-0.5 ring-1 ring-ink-700/60">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          title={m.label}
          aria-label={m.label}
          className={clsx(
            "grid h-7 w-7 place-items-center rounded-md transition-colors",
            value === m.id ? "bg-accent text-white" : "text-ink-200 hover:bg-ink-700",
          )}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}
