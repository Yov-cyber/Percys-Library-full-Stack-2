import clsx from "clsx";
import { useToasts, type Toast } from "../stores/toasts";

const icons: Record<string, React.ReactNode> = {
  info: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  success: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>,
  warn: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  error: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg>,
};

function getToneStyles(tone: string) {
  // Use CSS variables set by ThemeProvider so toasts adapt to theme
  switch (tone) {
    case "success":
      return {
        border: "1px solid rgba(var(--pl-accent-rgb) / 0.18)",
        background:
          "linear-gradient(90deg, rgba(var(--pl-accent-rgb) / 0.10), rgba(var(--pl-accent-rgb) / 0.04))",
        color: "var(--pl-fg)",
        iconColor: "var(--pl-accent)",
      } as const;
    case "warn":
      return {
        border: "1px solid rgba(245,158,11,0.22)",
        background:
          "linear-gradient(90deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))",
        color: "var(--pl-fg)",
        iconColor: "#f59e0b",
      } as const;
    case "error":
      return {
        border: "1px solid rgba(239,68,68,0.22)",
        background:
          "linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))",
        color: "var(--pl-fg)",
        iconColor: "#ef4444",
      } as const;
    default:
      return {
        border: "1px solid rgba(var(--pl-accent-rgb) / 0.18)",
        background:
          "linear-gradient(90deg, rgba(var(--pl-accent-rgb) / 0.08), rgba(var(--pl-accent-rgb) / 0.02))",
        color: "var(--pl-fg)",
        iconColor: "var(--pl-accent)",
      } as const;
  }
}

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const st = getToneStyles(toast.tone);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ border: st.border, background: st.background, color: st.color }}
      className={clsx(
        "pointer-events-auto relative flex items-start gap-3 rounded-2xl px-4 py-3 pr-3 text-sm font-semibold shadow-2xl backdrop-blur-xl",
        "max-w-md w-fit ml-auto animate-fade-in",
      )}
    >
      <div className="shrink-0 mt-0.5" style={{ color: st.iconColor }}>
        {icons[toast.tone]}
      </div>
      <div
        style={{ color: "var(--pl-fg)" }}
        className="flex min-w-0 flex-1 flex-col gap-1 leading-relaxed break-words"
      >
        <div className="flex items-center gap-2">
          <span className="break-words">{toast.message}</span>
          {toast.count > 1 && (
            <span
              className="shrink-0 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums"
              title={`${toast.count} eventos coalescidos`}
            >
              ×{toast.count}
            </span>
          )}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
            className="self-start rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/15"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const clear = useToasts((s) => s.clear);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed top-6 right-6 z-[100] flex flex-col items-end gap-2 max-w-[calc(100vw-3rem)]">
      {toasts.length > 1 && (
        <button
          type="button"
          onClick={clear}
          className="pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 backdrop-blur-md transition hover:bg-black/60"
        >
          Limpiar
        </button>
      )}
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} />
      ))}
    </div>
  );
}
