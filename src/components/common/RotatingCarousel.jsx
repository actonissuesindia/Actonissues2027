import { useEffect, useRef, useState } from 'react';
import TiltCard from './TiltCard';

// A 3D "coverflow" carousel — the active card sits front-and-center while
// its neighbors curve away to either side (rotated, scaled down, faded),
// like flipping through an arc rather than sliding flat left-to-right.
// Auto-advances on a timer, pauses on hover, and any visible side card is
// clickable to jump straight to it.
export default function RotatingCarousel({ items, renderItem, itemKey, interval = 5000 }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (paused || items.length <= 1) return undefined;
    timerRef.current = setInterval(() => setActive(a => (a + 1) % items.length), interval);
    return () => clearInterval(timerRef.current);
  }, [paused, items.length, interval]);

  // Reset to a valid index if the item list shrinks (e.g. an issue is unfeatured).
  useEffect(() => {
    if (active >= items.length) setActive(0);
  }, [items.length, active]);

  const goTo = (i) => setActive(((i % items.length) + items.length) % items.length);

  if (items.length === 0) return null;

  return (
    <div
      className="rotating-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rotating-carousel-stage">
        {items.map((item, i) => {
          let offset = i - active;
          if (offset > items.length / 2) offset -= items.length;
          if (offset < -items.length / 2) offset += items.length;
          const abs = Math.abs(offset);
          const isActive = offset === 0;
          if (abs > 2) return null; // beyond the visible arc

          const style = {
            transform: `translate(-50%, 0) translateX(${offset * 58}%) translateZ(${-abs * 140}px) rotateY(${offset * -32}deg) scale(${1 - abs * 0.16})`,
            zIndex: 10 - abs,
            opacity: 1 - abs * 0.4,
            cursor: isActive ? 'default' : 'pointer'
          };
          return (
            <div
              key={itemKey ? itemKey(item) : i}
              className="rotating-carousel-item"
              style={style}
              onClick={() => !isActive && goTo(i)}
            >
              {/* A smaller angle than the default — this rides on top of the arc's
                  own rotation, so it only needs to add a subtle cursor-following
                  wobble on each card, not a full independent tilt. */}
              <TiltCard maxDeg={10} className="carousel-item-tilt">
                {renderItem(item, isActive)}
              </TiltCard>
            </div>
          );
        })}
      </div>

      {items.length > 1 && (
        <>
          <button type="button" className="rotating-carousel-nav rotating-carousel-prev" onClick={() => goTo(active - 1)} aria-label="Previous">
            <i className="bi bi-chevron-left"></i>
          </button>
          <button type="button" className="rotating-carousel-nav rotating-carousel-next" onClick={() => goTo(active + 1)} aria-label="Next">
            <i className="bi bi-chevron-right"></i>
          </button>
          <div className="rotating-carousel-dots">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`rotating-carousel-dot ${i === active ? 'active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
              ></button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
