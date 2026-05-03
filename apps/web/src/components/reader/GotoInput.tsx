import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  pageCount: number;
  onSubmit: (page: number) => void;
  onClose: () => void;
}

/**
 * Small popover anchored to the top bar that lets the user jump to any
 * page by typing its 1-based number. Auto-focused on open, submits on
 * Enter, dismisses on Escape or blur. Validates against the comic's
 * pageCount so submitting an out-of-range value is silently clamped
 * rather than producing an error UI — the input is meant to be quick
 * and forgiving, not a strict form.
 */
export function GotoInput({ open, pageCount, onSubmit, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue("");
    // Focus on the next tick so any click that opened the popover
    // doesn't immediately steal focus back to the trigger.
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  function commit() {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && pageCount > 0) {
      const target = Math.max(0, Math.min(n - 1, pageCount - 1));
      onSubmit(target);
    }
    onClose();
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-14 z-30 flex items-center gap-2 rounded-lg bg-ink-900/95 px-3 py-2 shadow-xl ring-1 ring-ink-700">
      <span className="text-xs text-ink-300">Ir a página</span>
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={1}
        max={pageCount}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={onClose}
        placeholder={`1–${pageCount}`}
        className="w-24 rounded-md bg-ink-800 px-2 py-1 text-sm text-ink-50 outline-none ring-1 ring-ink-700 focus:ring-accent"
        aria-label="Número de página"
      />
      <button
        // The input above auto-closes on blur; without preventDefault on
        // mousedown the browser would fire blur first and unmount this
        // button before its click event ever lands, leaving it dead and
        // forcing users onto the Enter-key path.
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:opacity-90"
      >
        Ir
      </button>
    </div>
  );
}
