import { useEffect, useState } from "react";

export function useFullscreen() {
  const [isFs, setIsFs] = useState<boolean>(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  async function toggle(target?: HTMLElement | null) {
    try {
      if (!document.fullscreenElement) {
        await (target ?? document.documentElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* noop */
    }
  }
  return { isFs, toggle };
}
