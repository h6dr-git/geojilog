import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const start = prevRef.current;
    const end = target;
    if (start === end) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prevRef.current = end;
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}
