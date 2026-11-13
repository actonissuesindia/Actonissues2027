import { useEffect, useState } from 'react';

// Two docked buttons on the right edge of the screen — jump to the top or
// bottom of the page, each shown only when it's actually useful (no point
// offering "scroll to top" right after landing at the top).
export default function ScrollTopBottomButton() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const nearBottom = scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200;
        setShowTop(scrollY > 300);
        setShowBottom(!nearBottom);
        raf = null;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {showTop && (
        <button
          type="button"
          className="scroll-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Scroll to top"
          aria-label="Scroll to top of feed"
        >
          <i className="bi bi-chevron-up"></i>
        </button>
      )}
      {showBottom && (
        <button
          type="button"
          className="scroll-bottom-btn"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
          title="Scroll to bottom"
          aria-label="Scroll to bottom of feed"
        >
          <i className="bi bi-chevron-down"></i>
        </button>
      )}
    </>
  );
}
