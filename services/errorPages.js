const fs = require('fs');
const path = require('path');

// Friendly HTML pages for HTTP errors (404, 500, 401, …) and the maintenance
// page, all sharing the Bunny Bubbles mini-game.
//
// Only browsers navigating to a page get these. /api calls keep getting JSON,
// because the React app reads `message` out of the response body and shows it
// in its own UI — an HTML page there would just be an unreadable blob.

const TEMPLATES = path.join(__dirname, '..', 'templates');
const read = (file) => fs.readFileSync(path.join(TEMPLATES, file), 'utf8');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Buttons. `home` is always offered; each code adds the one next step that
// actually helps with that particular failure.
const ACTIONS = {
  home: '<a class="btn primary" href="/">Go to homepage</a>',
  back: '<button type="button" class="btn ghost" onclick="history.length > 1 ? history.back() : location.assign(\'/\')">Go back</button>',
  retry: '<button type="button" class="btn ghost" onclick="location.reload()">Try again</button>',
  login: '<a class="btn ghost" href="/login">Sign in</a>',
  feed: '<a class="btn ghost" href="/feed">Browse issues</a>'
};

const PAGES = {
  400: { emoji: '🤔', title: 'That request looks off', message: "We couldn't understand that request. The link may be broken or mistyped — check it and try again.", actions: ['back'] },
  401: { emoji: '🔐', title: 'Please sign in', message: 'You need to be signed in to see this page.', actions: ['login'] },
  403: { emoji: '🚧', title: "You don't have access", message: "Your account doesn't have permission to view this page. If you think it should, contact the site team.", actions: ['back'] },
  404: { emoji: '🕳️', title: 'Page not found', message: "This page doesn't exist — it may have been moved, deleted, or the link may be mistyped. Like an unreported pothole, it slipped through the cracks.", actions: ['feed'] },
  405: { emoji: '🙅', title: "That isn't allowed here", message: "This page can't be used that way. Go back and try again from the site itself.", actions: ['back'] },
  408: { emoji: '⏳', title: 'That took too long', message: 'The request timed out before it finished. Check your connection and try again.', actions: ['retry'] },
  410: { emoji: '🧹', title: 'This page is gone', message: 'This page has been permanently removed.', actions: ['feed'] },
  413: { emoji: '📦', title: "That's too large", message: 'What you sent is bigger than we accept. Try smaller or fewer files.', actions: ['back'] },
  429: { emoji: '🐢', title: 'Slow down a little', message: "You've made a lot of requests in a short time. Wait a minute, then try again.", actions: ['retry'] },
  500: { emoji: '🛠️', title: 'Something went wrong', message: "Something broke on our side — it's not your fault, and nothing you entered was posted. Try again in a moment.", actions: ['retry'] },
  502: { emoji: '🔌', title: 'Bad gateway', message: "We couldn't reach part of our service. This is usually brief — try again in a moment.", actions: ['retry'] },
  503: { emoji: '🌙', title: 'Temporarily unavailable', message: "We're briefly unavailable. Please try again in a few minutes.", actions: ['retry'] },
  504: { emoji: '⌛', title: 'Taking too long', message: "Our server didn't respond in time. Try again in a moment.", actions: ['retry'] }
};

// Any code without its own copy borrows its class's general wording.
const FALLBACK = {
  4: { emoji: '🤔', title: "Something's not right", message: "We couldn't complete that request.", actions: ['back'] },
  5: { emoji: '🛠️', title: 'Something went wrong', message: "Something broke on our side — it's not your fault. Try again in a moment.", actions: ['retry'] }
};

const ERROR_CODES = Object.keys(PAGES).map(Number);

function pageFor(status) {
  return PAGES[status] || FALLBACK[String(status)[0]] || FALLBACK[5];
}

function withGame(html, gameTitle) {
  return html
    .replace('{{GAME_CSS}}', () => read('partials/bunny-bubbles.css'))
    .replace('{{GAME}}', () => read('partials/bunny-bubbles.html').replace('{{GAME_TITLE}}', () => escapeHtml(gameTitle)));
}

// `reference` is the short code errorHandler also logs, so someone reporting a
// 500 can quote it and the stack trace can be found.
function renderErrorPage(status, { reference } = {}) {
  const page = pageFor(status);
  const actions = ['home', ...page.actions].map((a) => ACTIONS[a]).join('\n      ');
  return withGame(read('error.html'), "While you're here: Bunny Bubbles 🐰")
    .replace(/{{CODE}}/g, () => escapeHtml(status))
    .replace(/{{TITLE}}/g, () => escapeHtml(page.title))
    .replace('{{EMOJI}}', () => page.emoji)
    .replace('{{MESSAGE}}', () => escapeHtml(page.message))
    .replace('{{REFERENCE}}', () => (reference
      ? `<p class="ref">If you contact us about this, quote reference <code>${escapeHtml(reference)}</code>.</p>`
      : ''))
    .replace('{{ACTIONS}}', () => actions);
}

function renderMaintenancePage({ message, contactEmail, start } = {}) {
  return withGame(read('maintenance.html'), 'While you wait: Bunny Bubbles 🐰')
    .replace('{{MESSAGE}}', () => escapeHtml(message))
    .replace('{{CONTACT}}', () => (contactEmail
      ? `<p>Need to reach us? <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></p>`
      : ''))
    .replace('{{START}}', () => escapeHtml(start || ''));
}

// A browser loading a page, as opposed to fetch()/XHR from the React app or a
// script. /api is always JSON regardless of what the client says it accepts.
// Requires text/html to be named outright: browsers do that for page loads,
// while curl, scripts and <img> requests send */* and keep the old response.
function wantsHtml(req) {
  return !req.path.startsWith('/api') && /\btext\/html\b/i.test(req.get('accept') || '');
}

function sendErrorPage(res, status, opts) {
  res.status(status).set('Cache-Control', 'no-store').type('html').send(renderErrorPage(status, opts));
}

// Every path the React router (src/routes/AppRoutes.jsx) knows. Anything else
// gets a real 404 from the server instead of the SPA shell with a 200, which
// search engines flag as a "soft 404". tests/errorPages.test.js reads
// AppRoutes.jsx and fails if a route there is missing here — so adding a page
// without updating this list can't silently 404 it.
const SPA_ROUTES = [
  '/', '/about', '/feed', '/articles', '/articles/:slug', '/reporters/:id', '/issues/:id',
  '/login', '/forgot-password', '/register', '/terms', '/legal', '/privacy',
  '/find-a-lawyer', '/install', '/p/:slug',
  '/my-issues', '/games', '/profile', '/admin', '/author', '/lawyer', '/lawyer/profile',
  '/rti/new', '/rti/mine', '/rti/:id',
  '/report', '/dashboard', '/founders-message'
];

const SPA_PATTERNS = SPA_ROUTES.map((route) => new RegExp(
  `^${route.replace(/:[^/]+/g, '[^/]+')}/?$`, 'i'
));

function isSpaRoute(pathname) {
  return SPA_PATTERNS.some((re) => re.test(pathname));
}

module.exports = {
  ERROR_CODES,
  SPA_ROUTES,
  renderErrorPage,
  renderMaintenancePage,
  sendErrorPage,
  wantsHtml,
  isSpaRoute
};
