import { useEffect, useState } from "react";

interface Props {
  page: number;
  pageCount: number;
  /** Pages per minute used for ETA. Default ≈ 8s/page (a typical
   *  comic reading pace). Webtoon mode uses a higher value because
   *  pages are typically shorter. */
  pagesPerMinute?: number;
}

/**
 * Compact pill: "22:15 · ~12 min". Refreshes the clock every 30s — fine
 * granularity isn't needed and we want to keep the reader idle. The ETA
 * is purely a heuristic; persisting per-user reading speed is left for
 * a follow-up. Hidden when only one page remains since the message
 * would always be "now".
 */
export function ClockEta({ page, pageCount, pagesPerMinute = 7.5 }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, pageCount - 1 - page);
  const minutes = Math.round(remaining / pagesPerMinute);

  if (remaining <= 1) return null;

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const eta =
    minutes < 1
      ? "<1 min"
      : minutes < 60
      ? `~${minutes} min`
      : `~${(minutes / 60).toFixed(1)} h`;

  return (
    <span
      className="pl-pill !text-xs"
      aria-label={`Hora ${hh}:${mm}, tiempo estimado restante ${eta}`}
      title={`Tiempo restante estimado a ${pagesPerMinute.toFixed(1)} pág/min`}
    >
      {hh}:{mm} · {eta}
    </span>
  );
}
