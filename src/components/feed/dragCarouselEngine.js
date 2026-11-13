import gsap from 'gsap';

// Continuous drag/wheel carousel — ported from a CodePen demo (credit:
// supahfunk). Items are positioned with GSAP's x modifier + gsap.utils.wrap
// so the strip loops infinitely in either direction, and scroll velocity
// drives a subtle skew/rotate/scale on every item each frame for the
// momentum feel. Scoped to the given root (not `document`) so more than one
// of these could exist on a page, and everything it starts (the rAF loop,
// every listener) is torn down by the returned destroy() — the original
// demo's render() loop ran forever with nothing to stop it, which would
// leak once this component unmounts.
export default function mountDragCarousel(root, { onItemClick } = {}) {
  const $wrapper = root.querySelector('.dragcar__wrapper');
  const $items = root.querySelectorAll('.dragcar__item');
  if (!$wrapper || $items.length === 0) return () => {};

  let itemWidth = $items[0].clientWidth;
  let wrapWidth = $items.length * itemWidth;

  let scrollSpeed = 0;
  let oldScrollY = 0;
  let scrollY = 0;
  let y = 0;
  let rafId = null;

  // Gentle constant drift so the strip is never fully still — pauses the
  // moment the user takes over (hover or drag) rather than fighting their
  // input, and resumes on its own once they let go. Skipped entirely for
  // prefers-reduced-motion; manual wheel/drag/touch scrolling still works
  // either way, only the idle auto-drift is what's conditional.
  const AUTO_SCROLL_SPEED = 0.55;
  const autoScrollEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hovering = false;
  const handleHoverEnter = () => { hovering = true; };
  const handleHoverLeave = () => { hovering = false; };
  if (autoScrollEnabled) {
    root.addEventListener('mouseenter', handleHoverEnter);
    root.addEventListener('mouseleave', handleHoverLeave);
  }

  const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t;

  const dispose = (scroll) => {
    gsap.set($items, {
      x: (i) => i * itemWidth + scroll,
      modifiers: {
        x: (x) => `${gsap.utils.wrap(-itemWidth, wrapWidth - itemWidth, parseInt(x, 10))}px`
      }
    });
  };
  dispose(0);

  const handleMouseWheel = (e) => {
    scrollY -= e.deltaY * 0.9;
  };

  // A drag that barely moved should still register as a click on whatever
  // was under the pointer (View this issue) — only a real drag past this
  // threshold suppresses the click, so dragging the strip doesn't
  // accidentally also navigate away mid-gesture.
  const CLICK_DRAG_THRESHOLD = 6;
  let touchStart = 0;
  let touchX = 0;
  let isDragging = false;
  let dragDistance = 0;
  let downTarget = null;

  const handleTouchStart = (e) => {
    touchStart = e.clientX ?? e.touches[0].clientX;
    isDragging = true;
    dragDistance = 0;
    downTarget = e.target;
    root.classList.add('is-dragging');
  };
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    touchX = e.clientX ?? e.touches[0].clientX;
    const delta = (touchX - touchStart) * 2.5;
    scrollY += delta;
    dragDistance += Math.abs(touchX - touchStart);
    touchStart = touchX;
  };
  const handleTouchEnd = () => {
    isDragging = false;
    root.classList.remove('is-dragging');
    if (dragDistance < CLICK_DRAG_THRESHOLD && downTarget && onItemClick) {
      const $item = downTarget.closest('.dragcar__item');
      if ($item) onItemClick($item.dataset.issueId);
    }
    downTarget = null;
  };

  root.addEventListener('mousewheel', handleMouseWheel, { passive: true });
  root.addEventListener('touchstart', handleTouchStart);
  root.addEventListener('touchmove', handleTouchMove);
  root.addEventListener('touchend', handleTouchEnd);
  root.addEventListener('mousedown', handleTouchStart);
  root.addEventListener('mousemove', handleTouchMove);
  root.addEventListener('mouseleave', handleTouchEnd);
  root.addEventListener('mouseup', handleTouchEnd);
  const preventSelect = () => false;
  root.addEventListener('selectstart', preventSelect);

  const handleResize = () => {
    itemWidth = $items[0].clientWidth;
    wrapWidth = $items.length * itemWidth;
  };
  window.addEventListener('resize', handleResize);

  const render = () => {
    rafId = requestAnimationFrame(render);
    if (autoScrollEnabled && !isDragging && !hovering) scrollY -= AUTO_SCROLL_SPEED;
    y = lerp(y, scrollY, 0.1);
    dispose(y);

    scrollSpeed = y - oldScrollY;
    oldScrollY = y;

    gsap.to($items, {
      skewX: -scrollSpeed * 0.2,
      rotate: scrollSpeed * 0.01,
      scale: 1 - Math.min(100, Math.abs(scrollSpeed)) * 0.003,
      duration: 0.3,
      overwrite: true
    });
  };
  render();

  return function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    if (autoScrollEnabled) {
      root.removeEventListener('mouseenter', handleHoverEnter);
      root.removeEventListener('mouseleave', handleHoverLeave);
    }
    root.removeEventListener('mousewheel', handleMouseWheel);
    root.removeEventListener('touchstart', handleTouchStart);
    root.removeEventListener('touchmove', handleTouchMove);
    root.removeEventListener('touchend', handleTouchEnd);
    root.removeEventListener('mousedown', handleTouchStart);
    root.removeEventListener('mousemove', handleTouchMove);
    root.removeEventListener('mouseleave', handleTouchEnd);
    root.removeEventListener('mouseup', handleTouchEnd);
    root.removeEventListener('selectstart', preventSelect);
    window.removeEventListener('resize', handleResize);
    gsap.killTweensOf($items);
  };
}
