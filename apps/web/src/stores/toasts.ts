import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  tone: "info" | "success" | "warn" | "error";
  /** Wall-clock time the toast was created (used for cluster collapse). */
  createdAt: number;
  /** Number of identical pushes coalesced into this toast. */
  count: number;
  /** Optional inline action (e.g. "Undo"). */
  action?: ToastAction;
  /** When the toast should auto-dismiss; `null` means sticky. */
  autoDismissAt: number | null;
}

interface ToastOptions {
  /** Duration in ms before auto-dismissing. Default 2800ms. Pass 0 for sticky. */
  durationMs?: number;
  /** Optional inline action button. */
  action?: ToastAction;
  /** Stable identity used for in-place replace (e.g. progress updates). */
  id?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (
    message: string,
    tone?: Toast["tone"],
    options?: ToastOptions,
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

// Hard cap so a runaway loop can't paper-cut the screen.
const MAX_VISIBLE_TOASTS = 3;
// Pushes of the same (message, tone) within this window collapse into a
// single "x3"-style toast instead of stacking up.
const COALESCE_WINDOW_MS = 4000;
const DEFAULT_DURATION_MS = 2800;

// Per-toast auto-dismiss timers, kept outside the store so they're not
// reactive. We MUST clear the previous timer whenever a toast is
// coalesced or replaced — otherwise the original countdown keeps
// firing and the toast disappears prematurely.
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearDismissTimer(id: string) {
  const t = dismissTimers.get(id);
  if (t !== undefined) {
    clearTimeout(t);
    dismissTimers.delete(id);
  }
}

function scheduleDismiss(id: string, durationMs: number, run: () => void) {
  clearDismissTimer(id);
  if (durationMs <= 0) return;
  const handle = setTimeout(() => {
    dismissTimers.delete(id);
    run();
  }, durationMs);
  dismissTimers.set(id, handle);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    for (const t of dismissTimers.values()) {
      clearTimeout(t);
    }
    dismissTimers.clear();
  });
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(message, tone = "info", options = {}) {
    const now = Date.now();
    const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
    const autoDismissAt = durationMs > 0 ? now + durationMs : null;

    const current = get().toasts;

    // 1. If a stable id was passed, replace that toast in place. Useful
    //    for progress messages that keep evolving ("Subiendo… 30%").
    if (options.id) {
      const idx = current.findIndex((t) => t.id === options.id);
      if (idx >= 0) {
        const next = current.slice();
        next[idx] = {
          ...next[idx],
          message,
          tone,
          action: options.action ?? next[idx].action,
          autoDismissAt,
        };
        set({ toasts: next });
        scheduleDismiss(options.id, durationMs, () =>
          get().dismiss(options.id as string),
        );
        return options.id;
      }
    }

    // 2. Coalesce identical toasts that landed in quick succession into
    //    a single entry with a counter — this is what stops the "wall
    //    of notifications" effect when the user changes a setting that
    //    cascades several updates.
    const dupIndex = current.findIndex(
      (t) =>
        t.message === message &&
        t.tone === tone &&
        now - t.createdAt < COALESCE_WINDOW_MS,
    );
    if (dupIndex >= 0) {
      const next = current.slice();
      const existing = next[dupIndex];
      next[dupIndex] = {
        ...existing,
        count: existing.count + 1,
        autoDismissAt,
        action: options.action ?? existing.action,
      };
      set({ toasts: next });
      scheduleDismiss(existing.id, durationMs, () =>
        get().dismiss(existing.id),
      );
      return existing.id;
    }

    const id =
      options.id ?? `${now}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = {
      id,
      message,
      tone,
      createdAt: now,
      count: 1,
      action: options.action,
      autoDismissAt,
    };
    const merged = [...current, toast];
    // Drop oldest toasts beyond the cap and clear their pending timers.
    while (merged.length > MAX_VISIBLE_TOASTS) {
      const dropped = merged.shift();
      if (dropped) clearDismissTimer(dropped.id);
    }
    set({ toasts: merged });
    scheduleDismiss(id, durationMs, () => get().dismiss(id));
    return id;
  },
  dismiss(id) {
    clearDismissTimer(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  clear() {
    for (const t of get().toasts) clearDismissTimer(t.id);
    set({ toasts: [] });
  },
}));
