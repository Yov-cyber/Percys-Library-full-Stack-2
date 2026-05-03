import { useEffect, useRef, useState } from "react";

interface PanState {
  panX: number;
  panY: number;
  /** True while a drag is in flight. Consumers use this to suppress
   *  click-through navigation (otherwise letting go of a drag would
   *  also fire the page's click-zone handler). */
  dragging: boolean;
}

/**
 * Drag-to-pan helper for the reader. Activates only when `zoom > 1`
 * (otherwise the image fits the viewport and panning is meaningless).
 *
 * The hook is intentionally framework-light: it owns its own pan state
 * and wires pointer listeners to a wrapper element. Consumers apply
 * `translate3d(panX, panY, 0)` to whatever they want to move (typically
 * the same element that has `transform: scale(zoom)`).
 *
 * `resetKey` triggers a pan reset whenever it changes — pass the page
 * number so jumping pages always starts centered. The reset also fires
 * automatically when zoom drops back to ≤ 1 so re-entering a zoomed
 * state begins from origin instead of a stale offset.
 */
export function usePanZoom(zoom: number, resetKey: unknown) {
  const [state, setState] = useState<PanState>({ panX: 0, panY: 0, dragging: false });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Live values that don't trigger re-renders. Pointer move handlers
  // run frequently and we want them lock-free with respect to React.
  // `panRef` mirrors the latest pan state so the pointerdown handler
  // can read it without going through a stale closure (the listener
  // effect attaches once and would otherwise see only the initial
  // panX/panY of 0, which causes the second drag to snap back to the
  // origin instead of resuming where the first drag left off).
  const panRef = useRef({ panX: 0, panY: 0 });
  const startRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const movedRef = useRef(false);
  const draggingRef = useRef(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  panRef.current = { panX: state.panX, panY: state.panY };

  useEffect(() => {
    setState((s) => (s.panX === 0 && s.panY === 0 ? s : { panX: 0, panY: 0, dragging: false }));
  }, [resetKey]);

  useEffect(() => {
    if (zoom <= 1) {
      setState((s) => (s.panX === 0 && s.panY === 0 ? s : { panX: 0, panY: 0, dragging: false }));
    }
  }, [zoom]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    function down(e: PointerEvent) {
      // Only the primary mouse button or a single touch should pan; a
      // right-click would otherwise prevent the context menu, and a
      // second touch belongs to pinch-zoom (handled separately).
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (zoomRef.current <= 1) return;
      draggingRef.current = true;
      movedRef.current = false;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current.panX,
        panY: panRef.current.panY,
      };
      // Capture so we keep receiving move/up events even if the cursor
      // leaves the element bounds (which it routinely does at high zoom).
      try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      setState((s) => ({ ...s, dragging: true }));
    }

    function move(e: PointerEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (!movedRef.current && Math.hypot(dx, dy) > 4) movedRef.current = true;
      setState((s) => ({ ...s, panX: startRef.current.panX + dx, panY: startRef.current.panY + dy }));
    }

    function up() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setState((s) => ({ ...s, dragging: false }));
    }

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    // The listener attaches once per wrapper-element identity. Pan
    // values are read through `panRef.current` so this effect doesn't
    // need to re-run when state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapperRef.current]);

  /** Whether the most recent pointer-up was preceded by movement past
   *  the click-suppression threshold. Consumers check this in their
   *  click handler and swallow the event if true. The flag is reset on
   *  the next pointerdown. */
  const consumeClick = () => {
    const moved = movedRef.current;
    movedRef.current = false;
    return moved;
  };

  return { wrapperRef, panX: state.panX, panY: state.panY, dragging: state.dragging, consumeClick };
}
