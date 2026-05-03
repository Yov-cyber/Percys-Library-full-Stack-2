import { useEffect, useState } from "react";

/**
 * SSR-safe `matchMedia` subscription. Returns `false` on the server and
 * before the listener attaches, then updates as the query result changes.
 * Centralized so multiple components agree on the same result for the
 * same query (e.g. portrait detection in Reader + DoublePage).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
