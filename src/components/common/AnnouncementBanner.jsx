import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import burstConfetti, { burstEmoji } from '../../utils/confetti';
import { moodEmoji } from '../../utils/announcementMoods';

const CYCLE_MS = 5000;
const FADE_MS = 350;

const MOOD_ICON_CLASS = {
  announce: 'announcement-banner-icon-pulse',
  celebrate: 'announcement-banner-icon-bounce',
  warning: 'announcement-banner-icon-shake',
  sad: 'announcement-banner-icon-bob',
  love: 'announcement-banner-icon-heartbeat'
};

// Each mood gets one solid, on-brand hue — two close shades of the same
// color, same "Apple-style restraint" principle as the rest of the site's
// gradients (see app.css's root comment) — rather than a loud multi-color
// sweep. 'celebrate' reuses the brand's own terracotta accent color so it
// reads as a deliberate, on-brand highlight instead of a generic rainbow.
// The glow color (set as a CSS var --announcement-glow, see
// announcementGlow keyframe) matches each gradient's hue.
const MOOD_STYLE = {
  announce: { bg: 'linear-gradient(90deg, #2d4a7a, #1e3a5f)', glow: 'rgba(45, 74, 122, 0.5)' },
  celebrate: { bg: 'linear-gradient(90deg, #e08e45, #c9752f)', glow: 'rgba(224, 142, 69, 0.55)' },
  warning: { bg: 'linear-gradient(90deg, #dc2626, #991b1b)', glow: 'rgba(220, 38, 38, 0.5)' },
  sad: { bg: 'linear-gradient(90deg, #1e3a8a, #172554)', glow: 'rgba(30, 58, 138, 0.55)' },
  love: { bg: 'linear-gradient(90deg, #db2777, #9d174d)', glow: 'rgba(219, 39, 119, 0.5)' }
};

// A site-wide notice ticker Admin/Authority post from the Control Panel's
// Announcements tab (see AdminDashboard.jsx) — any number of them, each its
// own record with a mood/emoji. Cycles through all of them automatically;
// deleting one on the admin side removes it here on the next fetch (page
// load). No per-user dismiss — deliberately: this is for things everyone
// should see, like scheduled maintenance, not a per-visitor notification.
export default function AnnouncementBanner() {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const bannerRef = useRef(null);

  useEffect(() => {
    api.get('/announcements').then(res => setItems(res.data.announcements || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % items.length);
        setFading(false);
      }, FADE_MS);
    }, CYCLE_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  const current = items[Math.min(index, items.length - 1)];

  // Bursts once each time a new announcement becomes the one shown — every
  // mood gets a little burst of its own emoji, and 'celebrate' additionally
  // layers on the full colorful confetti. Keyed on the announcement's id so
  // it fires on entry, not on every re-render.
  //
  // x/y are computed fresh from the banner's live position (not a fixed
  // guess) so the burst starts where the banner actually is *right now* —
  // and if the banner has scrolled off-screen entirely, skipped outright,
  // rather than a burst appearing to float unanchored over whatever content
  // has scrolled up to replace it (position: fixed doesn't track scrolling
  // once it starts, so a stale/guessed position drifts from the banner the
  // moment the page moves).
  useEffect(() => {
    if (!current || !bannerRef.current) return;
    const rect = bannerRef.current.getBoundingClientRect();
    const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
    if (!onScreen) return;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    burstEmoji(x, y, moodEmoji(current.mood), 16);
    if (current.mood === 'celebrate') {
      burstConfetti(x, y, 45);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?._id]);

  if (items.length === 0) return null;

  const iconClass = MOOD_ICON_CLASS[current.mood] || MOOD_ICON_CLASS.announce;
  const style = MOOD_STYLE[current.mood] || MOOD_STYLE.announce;

  return (
    <div
      className="announcement-banner"
      ref={bannerRef}
      style={{ background: style.bg, '--announcement-glow': style.glow }}
    >
      <span className="announcement-banner-sparkle">✨</span>
      <span className={`announcement-banner-icon ${iconClass}`}>{moodEmoji(current.mood)}</span>
      <span
        className="announcement-banner-text"
        style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateY(-8px)' : 'translateY(0)' }}
      >
        <span className="visually-hidden">{current.text}</span>
        <span className="announcement-wave-text" aria-hidden="true">
          {/* Split on whitespace runs first (kept as their own chunks via
              the capturing group) and wrap each chunk so the per-letter
              spans it contains can't be separated by a line break — the
              previous version split straight into individual letter
              spans with nothing tying same-word letters together, so a
              narrow mobile viewport could (and did) wrap mid-word. Only
              the boundary *between* chunks (i.e. an actual space) is ever
              a valid break point now. A running `delay` counter keeps the
              wave animation flowing continuously across the whole
              message rather than restarting per word. */}
          {(() => {
            let delay = 0;
            return current.text.split(/(\s+)/).map((chunk, ci) => (
              <span key={ci} className="announcement-wave-word">
                {[...chunk].map((ch, i) => (
                  <span key={i} className="announcement-wave-letter" style={{ animationDelay: `${delay++ * 0.03}s` }}>
                    {ch}
                  </span>
                ))}
              </span>
            ));
          })()}
        </span>
      </span>
      <span className={`announcement-banner-icon announcement-banner-icon-mirror ${iconClass}`}>{moodEmoji(current.mood)}</span>
      <span className="announcement-banner-sparkle">✨</span>
      {items.length > 1 && (
        <span className="announcement-banner-dots">
          {items.map((a, i) => (
            <span key={a._id} className={`announcement-banner-dot ${i === index ? 'active' : ''}`}></span>
          ))}
        </span>
      )}
    </div>
  );
}
