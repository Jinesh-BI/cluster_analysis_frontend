// src/hooks/useCountUp.js
//
// Animates a displayed number from its previous value to a new target
// whenever the target changes — used for the mukkadam detail page's
// summary figures so a refresh/tab-switch reads as "counting up" rather
// than snapping. Respects prefers-reduced-motion by jumping straight to
// the target instead of animating.
import { useEffect, useRef, useState } from "react";

const REDUCE_MOTION =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    const to = Number(target) || 0;
    if (REDUCE_MOTION) {
      setValue(to);
      fromRef.current = to;
      return;
    }
    const from = fromRef.current;
    if (from === to) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3; // ease-out cubic
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
