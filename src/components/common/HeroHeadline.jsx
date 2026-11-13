import { Fragment, useEffect, useState } from 'react';

const CYCLE_MS = 5000;
const FADE_MS = 350;

// Mirrors the hardcoded fallback headline below (3 short lines, last one
// gradient-colored) for admin-entered quotes, which otherwise arrive as one
// flat, uncolored string with no accent at all. Splits on sentence-ending
// punctuation and colors the final sentence; a one-sentence quote instead
// gets just its last word colored, so there's always some accent.
function renderQuote(text) {
  const clauses = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  if (clauses.length < 2) {
    const words = text.trim().split(/\s+/);
    if (words.length < 2) return <span className="gradient-text">{text}</span>;
    const last = words.pop();
    return <>{words.join(' ')} <span className="gradient-text">{last}</span></>;
  }
  const last = clauses.pop();
  return (
    <>
      {clauses.map((c, i) => <Fragment key={i}>{c}<br /></Fragment>)}
      <span className="gradient-text">{last}</span>
    </>
  );
}

// Super Admin can override the Home hero headline with one or more custom
// lines from the Control Panel's "Hero Quotes" tab (see AdminDashboard.jsx
// and controllers/heroQuoteController.js) — cycles through all of them the
// same way AnnouncementBanner cycles announcements. With none saved, falls
// back to the original branded 3-line headline unchanged. `quotes` is
// fetched once by the parent (Home.jsx) alongside the eyebrow/description
// overrides, rather than fetched here, so the whole hero section only
// needs one round trip.
export default function HeroHeadline({ quotes }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!quotes || quotes.length < 2) return undefined;
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % quotes.length);
        setFading(false);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [quotes]);

  // null means the parent's fetch hasn't come back yet; [] means it has and
  // none are configured. Only the second is a reason to show the built-in
  // headline — treating them alike meant every visitor read "Your city. Your
  // voice. Out loud." for a moment before it was replaced by the headline the
  // Super Admin actually set. The placeholder keeps the hero's height so
  // nothing below it jumps when the real headline lands.
  if (quotes === null) {
    return (
      <h1 className="display-heading display-3 mb-4" aria-hidden="true" style={{ visibility: 'hidden' }}>
        &nbsp;<br />&nbsp;<br />&nbsp;
      </h1>
    );
  }

  if (quotes.length === 0) {
    return (
      <h1 className="display-heading display-3 mb-4">
        Your city.<br />Your voice.<br /><span className="gradient-text">Out loud.</span>
      </h1>
    );
  }

  const current = quotes[Math.min(index, quotes.length - 1)];

  return (
    <h1
      className="display-heading display-3 mb-4"
      style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(-8px)' : 'translateY(0)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}
    >
      {renderQuote(current.text)}
    </h1>
  );
}
