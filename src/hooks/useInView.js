import { useEffect, useRef, useState } from 'react';

// Tracks whether the element is currently in view — toggles back to false
// once it scrolls back out, so the reveal animation replays every time it
// re-enters (scrolling down into it, or back up into it), not just once.
export default function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, options || { threshold: 0.15 });
    observer.observe(ref.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}
