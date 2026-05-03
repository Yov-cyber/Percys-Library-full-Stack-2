interface Props {
  progressPct: number; // 0..100
  visible: boolean;
}

/**
 * Thin progress strip at the very top of the reader. Hue shifts subtly
 * from the user's accent colour at 0% to a softer green at 100% so the
 * reader gets visual feedback even with the rest of the chrome hidden.
 *
 * Stays visible during idle-hide on purpose — losing the only indicator
 * of progress would feel disorienting. Use the `visible` prop only to
 * toggle it via Settings.
 */
export function TopProgressBar({ progressPct, visible }: Props) {
  if (!visible) return null;
  const pct = Math.max(0, Math.min(100, progressPct));
  // Mix accent (hue from CSS variable) toward a soft green near 100%.
  // We can't read the live accent in JS reliably without forcing a
  // reflow, so we stack two layers: accent at the active width, plus
  // a subtle green tint that rises in opacity past 80%.
  const greenOpacity = pct < 80 ? 0 : (pct - 80) / 20;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[2px] bg-ink-700/30"
      aria-hidden="true"
    >
      <div
        className="h-full bg-accent transition-[width] duration-150"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute inset-0 h-full bg-emerald-400 transition-opacity duration-300"
        style={{ width: `${pct}%`, opacity: greenOpacity * 0.55, mixBlendMode: "screen" }}
      />
    </div>
  );
}
