import { useEffect, useState } from "react";

export function useIdleUI(idleMs = 2500): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let timer: number | undefined;
    function show() {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), idleMs);
    }
    show();
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    window.addEventListener("keydown", show);
    return () => {
      window.removeEventListener("mousemove", show);
      window.removeEventListener("touchstart", show);
      window.removeEventListener("keydown", show);
      window.clearTimeout(timer);
    };
  }, [idleMs]);
  return visible;
}
