import clsx from "clsx";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  /**
   * When true (default) the confirm button receives focus on open.
   * Pass `false` when the dialog wraps an input/textarea that should
   * own the initial focus — otherwise the button steals it back.
   */
  autoFocusConfirm?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/**
 * Modal dialog with consistent UX:
 *   - Esc cancels
 *   - Enter confirms (unless focus is inside a multiline input)
 *   - Click outside cancels
 *   - Confirm button auto-focuses (unless `autoFocusConfirm` is false)
 *   - `busy` disables both buttons so a slow operation can't be triggered twice
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  autoFocusConfirm = true,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !autoFocusConfirm) return;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, autoFocusConfirm]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busy) onCancel();
        return;
      }
      if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        // Don't hijack Enter inside multiline fields.
        if (target && target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (!busy) onConfirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-2 text-sm text-slate-300">{description}</p>
        )}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="pl-btn disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={clsx(
              "rounded-xl px-4 py-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              tone === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500",
            )}
          >
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
