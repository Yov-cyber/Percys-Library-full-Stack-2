import { useEffect, useRef, useState } from "react";

interface Options {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onDoubleTap?: () => void;
  /** Pinch handler — receives a relative scale factor where >1 = zoom in,
   *  <1 = zoom out. Called on pointermove while two touches are active. */
  onPinch?: (scale: number) => void;
  /** Minimum horizontal travel (px) to register a swipe. */
  threshold?: number;
}

/**
 * Lightweight pointer-based gestures for the reader. Designed to be a
 * no-op on desktop (only fires for `touch` pointer type) so it doesn't
 * compete with mouse-driven click zones.
 *
 *  - Horizontal swipe → onSwipeLeft / onSwipeRight (paged navigation).
 *  - Double-tap → onDoubleTap (toggle fit-width / original).
 *  - Two-finger pinch → onPinch(scale): the consumer multiplies its
 *    current zoom by the scale, so the hook stays unaware of zoom range
 *    and the caller can clamp.
 *
 * Gesture state and the latest callbacks live in refs so the listener
 * effect runs once per element. Otherwise, parent re-renders between
 * pointerdown and pointerup (e.g. useIdleUI flipping the cursor on
 * touchstart) would tear down the closure that captured `startX`,
 * leaving the new closure to read `clientX - 0` and report a swipe of
 * the absolute screen position.
 */
export function useTouchGestures(
  el: HTMLElement | null | (() => HTMLElement | null),
  { onSwipeLeft, onSwipeRight, onDoubleTap, onPinch, threshold = 60 }: Options,
) {
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const lastTapRef = useRef(0);
  const handlersRef = useRef({ onSwipeLeft, onSwipeRight, onDoubleTap, onPinch, threshold });
  // Keep the latest callbacks reachable from the listener without
  // causing the effect to re-attach.
  handlersRef.current = { onSwipeLeft, onSwipeRight, onDoubleTap, onPinch, threshold };
  // Resolve the caller's element/getter to a concrete DOM node and
  // only re-attach listeners when that node identity actually changes.
  // Without this, callers passing an inline `() => ref.current` would
  // produce a fresh function reference every parent render, churning
  // the effect each time and resetting the per-effect gesture state
  // (the pointers Map, pinch base distance, etc.). Mid-gesture renders
  // (which onPinch → setZoom triggers) would silently drop subsequent
  // pointer events because `pointers.has(id)` would be false on the
  // freshly rebuilt Map.
  const elFnRef = useRef(el);
  elFnRef.current = el;
  const [resolvedEl, setResolvedEl] = useState<HTMLElement | null>(null);
  // Intentionally dep-less: we want to re-resolve on every render so a
  // ref-mounted element is picked up after the first render. The setState
  // is conditional on identity change, so this can't infinite-loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const target = typeof elFnRef.current === "function" ? elFnRef.current() : elFnRef.current;
    if (target !== resolvedEl) setResolvedEl(target);
  });

  useEffect(() => {
    const target = resolvedEl;
    if (!target) return;

    // Active touch pointers, keyed by pointerId. We track up to two so we
    // can derive a pinch ratio. Anything beyond the second pointer is
    // ignored (a third finger neither cancels the pinch nor triggers a
    // swipe, which matches every native viewer's behaviour).
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchBaseDist = 0;
    let pinchActive = false;

    function distance() {
      const pts = Array.from(pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    }

    function down(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        startRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        pinchActive = false;
      } else if (pointers.size === 2) {
        // Second finger touched down — we're now in a pinch gesture.
        // Suppress the pending tap/swipe so lifting either finger doesn't
        // also fire a stray page turn.
        pinchBaseDist = distance();
        pinchActive = true;
        lastTapRef.current = 0;
      }
    }

    function move(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const h = handlersRef.current;
      if (pinchActive && pointers.size >= 2 && pinchBaseDist > 0) {
        const d = distance();
        if (d > 0) {
          const scale = d / pinchBaseDist;
          h.onPinch?.(scale);
          // Reset the base so subsequent moves report deltas relative
          // to the latest position — keeps zoom changes incremental
          // instead of growing unboundedly.
          pinchBaseDist = d;
        }
      }
    }

    function up(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      const wasPinch = pinchActive;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchActive = false;
      if (wasPinch || pointers.size > 0) return;

      // Single-finger gesture completed — evaluate tap / swipe.
      const { x, y, t } = startRef.current;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dt = e.timeStamp - t;
      const h = handlersRef.current;

      // Tap: tiny travel + short duration. Detect double-tap by gap.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
        const now = e.timeStamp;
        if (now - lastTapRef.current < 300) {
          h.onDoubleTap?.();
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
        return;
      }

      // Swipe: predominantly horizontal motion past threshold.
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > h.threshold) {
        if (dx < 0) h.onSwipeLeft?.();
        else h.onSwipeRight?.();
      }
    }

    function cancel(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchActive = false;
    }

    target.addEventListener("pointerdown", down);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", cancel);
    return () => {
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", cancel);
    };
  }, [resolvedEl]);
}
