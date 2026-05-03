import { useEffect, useRef } from "react";

/**
 * Smooth auto-scroll for vertical reading containers (Webtoon / Continuous).
 * Uses requestAnimationFrame and accumulates fractional pixels so we stay
 * smooth at any speed, including very slow speeds (10–20 px/s) where a
 * naive integer-tick scroll would visibly jitter.
 *
 * `getEl` is a function so the consumer can pass a ref-by-id lookup
 * without forcing the hook to know about the DOM tree at hook-construction
 * time. The hook becomes a no-op when `enabled` is false or `speed <= 0`.
 */
export function useAutoScroll(
  getEl: () => HTMLElement | null,
  enabled: boolean,
  speed: number, // pixels per second
) {
  const accum = useRef(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || speed <= 0) {
      last.current = null;
      accum.current = 0;
      return;
    }
    let raf = 0;
    function tick(t: number) {
      const el = getEl();
      if (!el) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (last.current == null) last.current = t;
      // Cap dt at 100ms so returning from a backgrounded tab (which can
      // produce a multi-second timestamp gap) doesn't dump thousands of
      // pixels of scroll in a single frame.
      const dt = Math.min((t - last.current) / 1000, 0.1);
      last.current = t;
      accum.current += dt * speed;
      if (accum.current >= 1) {
        const px = Math.floor(accum.current);
        accum.current -= px;
        el.scrollTop += px;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
    // getEl is deliberately not a dep — the consumer guarantees stability.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, speed]);
}
