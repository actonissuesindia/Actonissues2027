import { useEffect, useRef } from 'react';

// Mouse-tracked 3D tilt: rotates the element toward the cursor, via CSS
// custom properties the stylesheet reads (--tilt-x/--tilt-y) rather than
// writing el.style.transform directly, so it composes with each card type's
// own hover lift/scale instead of clobbering it. Skipped on touch devices,
// where there's no cursor to track.
export default function useTilt(maxDeg = 16) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(pointer: coarse)').matches) return undefined;

    let raf = null;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-x', `${((0.5 - py) * maxDeg * 2).toFixed(2)}deg`);
        el.style.setProperty('--tilt-y', `${((px - 0.5) * maxDeg * 2).toFixed(2)}deg`);
        raf = null;
      });
    };

    const onLeave = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };

    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [maxDeg]);

  return ref;
}
