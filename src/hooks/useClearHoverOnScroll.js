import { useEffect } from 'react';

// Browsers only re-resolve `:hover` on an actual pointer event (mousemove,
// mouseover, ...) — scrolling content out from under a stationary cursor
// does not trigger one. That leaves hover-driven effects (the card
// "spotlight dims siblings" rule and TiltCard's 3D tilt in app.css/useTilt)
// stuck applied to a card that has since scrolled off-screen. Toggling
// pointer-events off makes that card ineligible for hit-testing, so the
// browser immediately drops its stale :hover (and fires mouseleave,
// resetting the tilt) — re-enabling it a frame later leaves everything
// hover-free until the cursor genuinely moves again, which is correct.
// Registered with capture so it also catches scroll on nested containers
// (any future overflow:auto panel), since "scroll" doesn't bubble but does
// propagate through the capture phase.
export default function useClearHoverOnScroll() {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;

    let clearing = false;
    const onScroll = () => {
      if (clearing) return;
      clearing = true;
      document.body.style.pointerEvents = 'none';
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
        clearing = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);
}
