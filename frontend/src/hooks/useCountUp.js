import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * useCountUp — animasi angka dari 0 → target (stats bar, skor ring).
 * Menghormati prefers-reduced-motion (langsung ke nilai akhir).
 */
export function useCountUp(target, { duration = 1.2, decimals = 0 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null) return undefined;
    if (reduced) {
      setValue(Number(target));
      return undefined;
    }
    const controls = animate(0, Number(target), {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setValue(Number(v.toFixed(decimals))),
    });
    return () => controls.stop();
  }, [target, duration, decimals, reduced]);

  return value;
}
