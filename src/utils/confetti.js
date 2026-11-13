// A small celebratory particle burst — no canvas-confetti dependency, just
// DOM nodes animated with CSS (see .confetti-piece in app.css) and cleaned
// up after the animation finishes.
//
// x/y are viewport (position: fixed) coordinates, resolved once at call
// time — always compute them fresh from the source element's current
// getBoundingClientRect() right before calling, never reuse a stale value.
// A burst doesn't track scrolling after it starts, but that's fine for its
// ~1.5s lifetime; what actually matters is that it starts in the right
// place for wherever the page is scrolled to *now*.
const COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function burstConfetti(x = window.innerWidth / 2, y = window.innerHeight / 3, count = 40) {
  const container = document.createElement('div');
  container.className = 'confetti-burst';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const distance = 70 + Math.random() * 150;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.6 - 60;
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.setProperty('--dx', `${dx}px`);
    piece.style.setProperty('--dy', `${dy}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    piece.style.background = COLORS[i % COLORS.length];
    piece.style.animationDelay = `${Math.random() * 0.12}s`;
    // Mix circles, squares, and a few star shapes (clip-path) for variety
    // instead of every piece being the same dot/square.
    const shape = i % 5;
    if (shape === 0) {
      piece.style.borderRadius = '50%';
    } else if (shape === 1) {
      piece.classList.add('confetti-star');
    } else {
      piece.style.borderRadius = '2px';
    }
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 1800);
}

// Same outward-burst physics as burstConfetti, but each piece is a given
// emoji instead of a colored shape — used for the announcement banner
// (see AnnouncementBanner.jsx) so every mood gets its own little moment,
// not just the 'celebrate' one. Same x/y contract as burstConfetti above.
export function burstEmoji(x = window.innerWidth / 2, y = window.innerHeight / 3, emoji = '✨', count = 16) {
  const container = document.createElement('div');
  container.className = 'confetti-burst';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'emoji-burst-piece';
    piece.textContent = emoji;
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 130;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance * 0.6 - 50;
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.fontSize = `${0.9 + Math.random() * 0.8}rem`;
    piece.style.setProperty('--dx', `${dx}px`);
    piece.style.setProperty('--dy', `${dy}px`);
    piece.style.setProperty('--rot', `${Math.random() * 360 - 180}deg`);
    piece.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 1800);
}

// A fuller, full-page celebration: flowers/balloons/ribbons raining down
// from the top of the viewport across its whole width, layered on top of
// burstConfetti's center burst for a bigger "party" moment (e.g. after
// successfully posting an issue) rather than a single small burst.
const RAIN_EMOJI = ['🎈', '🌸', '🎊', '🌺', '🎉', '🌼', '🎀', '✨'];

export function celebrationRain(count = 60, durationMs = 3400) {
  const container = document.createElement('div');
  container.className = 'celebration-rain';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'celebration-rain-piece';
    piece.textContent = RAIN_EMOJI[i % RAIN_EMOJI.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.fontSize = `${1 + Math.random() * 1.4}rem`;
    piece.style.setProperty('--fall-duration', `${2.4 + Math.random() * 1.8}s`);
    piece.style.setProperty('--fall-delay', `${Math.random() * 1}s`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 180}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), durationMs + 1500);
}
