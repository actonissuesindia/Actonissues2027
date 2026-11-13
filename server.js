require('dotenv').config();

const express = require('express');
const compression = require('compression');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { helmet, limiter, ogImageLimiter } = require('./middleware/security');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const health = require('./config/health');
const swagger = require('./swagger/swagger');
const ogImageService = require('./services/ogImageService');
const errorPages = require('./services/errorPages');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

// A hardcoded fallback here would mean every deployment missing this env var
// signs sessions with the same secret anyone can read in this public
// repo — letting an attacker forge a valid session cookie (including an
// Admin one). Fail loudly instead of silently starting up insecure; the dev
// fallback is fine since it's never used outside a local machine.
if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production — refusing to start with an insecure default.');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret';

// Trust the first proxy (needed for secure cookies behind a load balancer / reverse proxy).
app.set('trust proxy', 1);

// connect-mongo's internal MongoClient.connect() promise has no catch handler attached
// anywhere in the library. If Mongo is unreachable when the store is created (e.g. the
// app container starts before mongod is ready to accept connections in docker-compose),
// that rejection is unhandled and Node kills the whole process. Log and keep running —
// requests that need the session store will fail individually and surface as a 500
// through errorHandler instead of taking the entire server down.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err?.message || err);
});

// ---- Database ----
// Long enough for a cross-region connection (e.g. europe-west1 to a
// Mumbai-hosted Atlas cluster) to complete, while still shorter than
// Mongoose's 30s default.
mongoose.set('bufferTimeoutMS', 20000);
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 })
  .then(async () => {
    console.log('MongoDB connected');
    // Keep indexes in sync with the schema (e.g. email/phone moved to sparse
    // unique indexes) — a plain unique index from an older schema version
    // would otherwise reject a second document with no email at all.
    await require('./models/User').syncIndexes();
    // Issue.js's location.geo 2dsphere index (radius search) is new — make
    // sure it actually exists rather than relying on Mongoose's own
    // best-effort background index build, since a missing 2dsphere index
    // makes every $near query throw instead of just returning zero results.
    await require('./models/Issue').syncIndexes();
  })
  .catch(err => console.error('MongoDB connection error:', err.message));

// actonissues.blog was the domain used while actonissues.com's setup was
// stuck (see docs/DEPLOYMENT.md Step 8) — both are still mapped to this same
// Cloud Run service in the console (kept that way rather than removing the
// old mapping), but visitors should land on the one canonical .com URL
// rather than two live copies of the same site under different names.
// www.actonissues.com is a different origin than actonissues.com as far as
// Google Sign-In is concerned — only the bare domain is registered under
// Authorized JavaScript origins in Google Cloud Console (see
// docs/DEPLOYMENT.md Step 19), so a visitor landing on the www. variant
// (a browser autofilling it, an old link, etc.) gets a same-site-looking
// page where Sign In with Google fails with origin_mismatch. Redirecting
// server-side, before any client JS (and Google's own check) ever runs,
// fixes it regardless of which variant a visitor's browser happens to land on.
app.use((req, res, next) => {
  if (req.hostname === 'actonissues.blog' || req.hostname === 'www.actonissues.blog' || req.hostname === 'www.actonissues.com') {
    return res.redirect(301, `https://actonissues.com${req.originalUrl}`);
  }
  next();
});

// Maintenance switch: set MAINTENANCE_MODE=true in Cloud Run's variables to
// show a "back soon" page on every URL instead of the site. 503 + Retry-After
// tells Google the outage is temporary so search ranking isn't hurt. Nothing
// is deleted — set it back to false (or remove it) and the site returns.
// Optional: MAINTENANCE_CONTACT_EMAIL and MAINTENANCE_MESSAGE customise the page.
// The page (templates/maintenance.html) shows a 1-hour countdown that restarts
// every hour. MAINTENANCE_START (ISO time, e.g. 2026-11-13T14:30:00+05:30)
// sets when the cycle begins; unset, it lines up with the top of each hour.
app.use((req, res, next) => {
  if (String(process.env.MAINTENANCE_MODE).toLowerCase() !== 'true') return next();
  res.set('Retry-After', '3600');
  res.set('Cache-Control', 'no-store');
  if (req.path.startsWith('/api')) return res.status(503).json({ message: 'Site is temporarily offline for maintenance.' });
  res.status(503).type('html').send(errorPages.renderMaintenancePage({
    message: process.env.MAINTENANCE_MESSAGE || "Act On Issues is taking a short break while we make improvements. We'll be back soon.",
    contactEmail: process.env.MAINTENANCE_CONTACT_EMAIL,
    start: process.env.MAINTENANCE_START
  }));
});

// Preview every error page locally: http://localhost:3001/__errors/404 (or
// /__errors for the list). Not registered in production.
if (!isProd) {
  app.get('/__errors', (req, res) => {
    const links = errorPages.ERROR_CODES.map(c => `<li><a href="/__errors/${c}">${c}</a></li>`).join('');
    res.type('html').send(`<!doctype html><title>Error pages</title><h1>Error pages</h1><ul>${links}<li><a href="/__errors/maintenance">maintenance</a></li></ul>`);
  });
  app.get('/__errors/maintenance', (req, res) => {
    res.type('html').send(errorPages.renderMaintenancePage({
      message: "Act On Issues is taking a short break while we make improvements. We'll be back soon.",
      contactEmail: 'support@example.com'
    }));
  });
  app.get('/__errors/:code', (req, res) => {
    const code = Number(req.params.code);
    if (!(code >= 400 && code <= 599)) return errorPages.sendErrorPage(res, 404);
    errorPages.sendErrorPage(res, code, code >= 500 ? { reference: 'a1b2c3' } : {});
  });
}

// ---- Core middleware ----
// crossOriginOpenerPolicy defaults to 'same-origin', which cuts off the
// popup Google Sign-In opens (accounts.google.com/gsi/transform) from
// talking back to this page — it hangs on a blank screen forever.
// 'same-origin-allow-popups' keeps the isolation but still lets an
// opened popup report its result back, which Google's flow needs.
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
// Gzips every response above compression's 1KB default threshold — the built
// JS bundle and every JSON API response were going out uncompressed before
// this, which on a slow/mobile connection is a meaningful chunk of the "lag".
app.use(compression());
if (!isProd) {
  // In dev the SPA runs on a different origin (Vite), so allow it with credentials.
  const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
  app.use(cors({ origin: origins, credentials: true }));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mounted ahead of the session middleware below — this is an unauthenticated
// server-to-server callback from Brevo (see docs/DEPLOYMENT.md Step 17), not
// a browser request, so it has no business creating a session store entry
// on every inbound email.
app.use('/api/webhooks', require('./routes/webhookRoutes'));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // Reuse Mongoose's own connection (tuned above for cross-region latency)
  // instead of connect-mongo opening a second, untuned connection to the
  // same cross-region database — that second connection was the one
  // actually dropping with ECONNRESET under the same latency conditions.
  store: MongoStore.create({ client: mongoose.connection.getClient() }),
  cookie: {
    httpOnly: true,
    // Only require HTTPS-only cookies when explicitly enabled (TLS terminating in front).
    secure: process.env.COOKIE_SECURE === 'true',
    // Blocks the cookie from being sent on cross-site requests (e.g. a form
    // on another site auto-submitting to our API) — the main defense
    // against CSRF here, since there's no separate CSRF token in play.
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// Serve uploaded files (local disk storage).
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// A search engine can't discover /issues/:id pages any other way — they're
// created constantly and aren't linked from any static page — so the
// sitemap has to be generated from the live database, not a fixed file.
// Registered ahead of express.static below (which would otherwise serve the
// old static public/sitemap.xml first) and works even without a dist/ build,
// since it only needs Mongo, not the SPA bundle.
app.get('/sitemap.xml', async (req, res) => {
  const origin = 'https://actonissues.com';
  const staticUrls = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/about', changefreq: 'monthly', priority: '0.8' },
    { loc: '/feed', changefreq: 'daily', priority: '0.9' },
    { loc: '/articles', changefreq: 'weekly', priority: '0.7' },
    { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
    { loc: '/legal', changefreq: 'yearly', priority: '0.3' },
    { loc: '/privacy', changefreq: 'yearly', priority: '0.3' }
  ];

  let issueUrls = [];
  try {
    const Issue = require('./models/Issue');
    // Capped at 20,000 — comfortably within a single sitemap's 50,000-URL
    // limit while leaving headroom; revisit with a sitemap index (multiple
    // files) long before actually hitting that ceiling.
    const issues = await Issue.find({ moderationStatus: 'Approved' })
      .select('_id updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20000)
      .lean();
    issueUrls = issues.map(i => ({
      loc: `/issues/${i._id}`,
      lastmod: new Date(i.updatedAt).toISOString().slice(0, 10),
      changefreq: 'weekly',
      priority: '0.6'
    }));
  } catch (err) {
    console.error('Sitemap: failed to load issues, serving static URLs only:', err.message);
  }

  let articleUrls = [];
  try {
    const Article = require('./models/Article');
    const articles = await Article.find({ status: 'Published' })
      .select('slug updatedAt')
      .sort({ publishedAt: -1 })
      .lean();
    articleUrls = articles.map(a => ({
      loc: `/articles/${a.slug}`,
      lastmod: new Date(a.updatedAt).toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.7'
    }));
  } catch (err) {
    console.error('Sitemap: failed to load articles:', err.message);
  }

  let customPageUrls = [];
  try {
    const CustomPage = require('./models/CustomPage');
    const pages = await CustomPage.find({ status: 'Published' })
      .select('slug updatedAt')
      .sort({ publishedAt: -1 })
      .lean();
    customPageUrls = pages.map(p => ({
      loc: `/p/${p.slug}`,
      lastmod: new Date(p.updatedAt).toISOString().slice(0, 10),
      changefreq: 'monthly',
      priority: '0.6'
    }));
  } catch (err) {
    console.error('Sitemap: failed to load custom pages:', err.message);
  }

  let reporterUrls = [];
  try {
    const Issue = require('./models/Issue');
    const User = require('./models/User');
    // Distinct reporters with at least one Approved issue — not every
    // registered user, so a profile only shows up once it's actually
    // substantive (matches the same reasoning as deferring per-city pages
    // until there's real data).
    const reporterIds = await Issue.distinct('reporter', { moderationStatus: 'Approved' });
    const activeUsers = await User.find({ _id: { $in: reporterIds }, isDisabled: { $ne: true } })
      .select('_id')
      .limit(20000)
      .lean();
    reporterUrls = activeUsers.map(u => ({
      loc: `/reporters/${u._id}`,
      changefreq: 'monthly',
      priority: '0.5'
    }));
  } catch (err) {
    console.error('Sitemap: failed to load reporters:', err.message);
  }

  const urlXml = ({ loc, lastmod, changefreq, priority }) => `  <url>
    <loc>${origin}${loc}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...issueUrls, ...articleUrls, ...customPageUrls, ...reporterUrls].map(urlXml).join('\n')}
</urlset>`;

  res.type('application/xml').send(xml);
});

// The images behind every link preview this site advertises — one fixed
// 1200x630 card per shareable URL, rendered on demand from the post's own
// photo (see services/ogImageService.js for why the attachment itself can't
// be handed to a crawler directly). Registered here, above express.static and
// the SPA catch-all, and outside the dist/ block below so previews still work
// in local dev where there's no build.
app.use('/og', ogImageLimiter, require('./routes/ogImageRoutes'));

// ---- API routes ----
app.get('/api/health', health);
// Mounted above the general limiter so it's exempt — it has its own,
// per-user-keyed limiter suited to its polling traffic (see gameLimiter).
app.use('/api/games/ludo', require('./routes/ludoRoutes'));
app.use('/api', limiter);
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/issues', require('./routes/issueRoutes'));
app.use('/api/rti-requests', require('./routes/rtiRequestRoutes'));
app.use('/api/lawyers', require('./routes/lawyerRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/attachments', require('./routes/attachmentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/push', require('./routes/pushRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/hero-quotes', require('./routes/heroQuoteRoutes'));
app.use('/api/founder-image', require('./routes/founderImageRoutes'));
app.use('/api/logo', require('./routes/logoRoutes'));
app.use('/api/page-blocks', require('./routes/pageBlockRoutes'));
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/pages', require('./routes/customPageRoutes'));
app.use('/api/reporters', require('./routes/reporterRoutes'));

// Google Cloud Storage uploads are optional — only mount when configured.
if (process.env.GCS_BUCKET) {
  app.use('/api/gcs', require('./routes/gcsRoutes'));
}

// API docs
swagger(app);

// ---- Serve the React SPA in production ----
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Analytics (GTM/GA4/Clarity) IDs can't be baked into the frontend bundle
  // the way src/utils/analytics.js does for local dev — Cloud Run's env vars
  // are only injected once the container is *running*, but the Dockerfile
  // runs `vite build` during the image build itself, before that happens.
  // So `import.meta.env.VITE_*` is always empty in production regardless of
  // what's set on Cloud Run. Instead, inject the same snippets server-side,
  // read from process.env at request time — same values, same env var
  // names, just resolved at runtime instead of build time.
  //
  // The Geoapify key below rides the same workaround even though it isn't
  // analytics: AddressAutocomplete.jsx needs it as a plain JS value (not a
  // <script src>), so it's exposed as `window.__GEOAPIFY_KEY__` instead of a
  // vendor snippet — see docs/DEPLOYMENT.md Step 20.
  const ANALYTICS_HEAD = [
    process.env.VITE_GTM_ID && `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${process.env.VITE_GTM_ID}');</script>`,
    process.env.VITE_GA_ID && `<script async src="https://www.googletagmanager.com/gtag/js?id=${process.env.VITE_GA_ID}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.VITE_GA_ID}');</script>`,
    process.env.VITE_CLARITY_ID && `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.VITE_CLARITY_ID}");</script>`,
    process.env.ADSENSE_CLIENT_ID && `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.ADSENSE_CLIENT_ID}" crossorigin="anonymous"></script>`,
    process.env.VITE_GEOAPIFY_API_KEY && `<script>window.__GEOAPIFY_KEY__=${JSON.stringify(process.env.VITE_GEOAPIFY_API_KEY)};</script>`,
    // Same rides-along-workaround as the Geoapify line above, for the Feed
    // page's Google Places search box — see docs/DEPLOYMENT.md Step 21.
    process.env.VITE_GOOGLE_PLACES_API_KEY && `<script>window.__GOOGLE_PLACES_KEY__=${JSON.stringify(process.env.VITE_GOOGLE_PLACES_API_KEY)};</script>`
  ].filter(Boolean).join('\n    ');
  const ANALYTICS_BODY = process.env.VITE_GTM_ID
    ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${process.env.VITE_GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
    : '';
  const injectAnalytics = (html) => (ANALYTICS_HEAD || ANALYTICS_BODY
    ? html.replace('</head>', `${ANALYTICS_HEAD}\n  </head>`).replace('<body>', `<body>\n    ${ANALYTICS_BODY}`)
    : html);

  // The one true domain — actonissues.blog still resolves to this same
  // service (see the redirect above) purely so old links don't 404, but
  // every URL this server advertises to search engines/crawlers (canonical,
  // og:url, sitemap) should point at .com so it's the one Google indexes.
  const CANONICAL_ORIGIN = 'https://actonissues.com';

  // Read once, not per request: the built index.html can't change while the
  // container is alive (a deploy replaces the whole container), and every
  // page a crawler asks for goes through here — a preview only gets built at
  // all if the page comes back quickly enough.
  let indexHtml = null;
  const readIndexHtml = () => {
    if (indexHtml === null) indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    return indexHtml;
  };
  const truncate = (s, max) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
  // A description pulled from a user-written post can carry newlines and
  // double spaces; inside a meta attribute those survive into the preview and
  // render as ragged gaps.
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  // Every shareable page's <head>, built one way.
  //
  // Each route below used to assemble its own tag list, and they had drifted
  // apart: a post with a photo advertised a large-image card, a post without
  // one advertised a small logo card, a custom page advertised no image or
  // type at all, and anything the route didn't recognise advertised nothing —
  // which is why the same site produced visibly different previews depending
  // on what was shared and where. One helper means one card shape everywhere:
  // title, description, and a 1200x630 image, on every link, always.
  const injectMeta = (html, { title, description, url, image = '/og/default.jpg', type = 'website', documentTitle }) => {
    const safeTitle = escapeHtml(oneLine(title));
    const safeDescription = escapeHtml(truncate(oneLine(description), 200));
    // Absolute, and on the canonical host: a relative og:image is ignored
    // outright by most crawlers, since they have no page context to resolve it
    // against.
    const imageUrl = `${CANONICAL_ORIGIN}${image}`;
    const tags = [
      `<meta name="description" content="${safeDescription}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:type" content="${type}" />`,
      `<meta property="og:title" content="${safeTitle}" />`,
      `<meta property="og:description" content="${safeDescription}" />`,
      `<meta property="og:url" content="${url}" />`,
      '<meta property="og:locale" content="en_IN" />',
      `<meta property="og:image" content="${imageUrl}" />`,
      // WhatsApp reads the https-specific one; declaring the dimensions up
      // front is what lets a crawler lay out the big card immediately instead
      // of downloading the image first and sometimes giving up before it does.
      `<meta property="og:image:secure_url" content="${imageUrl}" />`,
      '<meta property="og:image:type" content="image/jpeg" />',
      // Read from the renderer rather than repeated as literals, so the
      // advertised size can't drift from the size actually served.
      `<meta property="og:image:width" content="${ogImageService.WIDTH}" />`,
      `<meta property="og:image:height" content="${ogImageService.HEIGHT}" />`,
      `<meta property="og:image:alt" content="${safeTitle}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${safeTitle}" />`,
      `<meta name="twitter:description" content="${safeDescription}" />`,
      `<meta name="twitter:image" content="${imageUrl}" />`
    ].join('\n    ');

    return html
      // Strip index.html's site-wide default card first — all of it, not the
      // two or three tags each old branch happened to remember. Leaving any of
      // it in place hands the crawler two values for the same property and
      // lets it pick, which is exactly how one post came out with a photo card
      // and the next with a logo card. og:site_name is the one default that
      // stays: it's the same on every page.
      .replace(/\s*<meta property="og:(?!site_name)[^"]*" content="[^"]*" \/>/g, '')
      .replace(/\s*<meta name="twitter:[^"]*" content="[^"]*" \/>/g, '')
      .replace(/\s*<meta name="description" content="[^"]*" \/>/, '')
      .replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '')
      .replace(
        '<title>Act On Issues</title>',
        `<title>${escapeHtml(oneLine(documentTitle || `${title} — Act On Issues`))}</title>\n    ${tags}`
      );
  };

  // Link-preview crawlers (WhatsApp, Telegram, Outlook, iMessage, ...) don't
  // run JavaScript — they fetch the URL once and read whatever <meta> tags
  // are in the raw HTML response. The SPA's own index.html is static and
  // identical for every route, so a shared /issues/:id link would only ever
  // preview as the generic app description with no clue what the actual
  // post is about. This serves the same index.html but with that one
  // issue's title/description/photo injected into the <head> first —
  // registered ahead of the catch-all below so it wins for this one route,
  // while real browsers still get the same React app underneath it.
  app.get('/issues/:id', async (req, res, next) => {
    try {
      const Issue = require('./models/Issue');
      const issue = await Issue.findById(req.params.id).select('title description attachments moderationStatus').lean();
      let html = readIndexHtml();
      // Pending/Rejected posts are only visible to their owner/staff (see
      // issueController) — a public link-preview crawler is neither, so
      // this only injects real content for a post that's actually public.
      // An unapproved or unknown post still previews as the branded site card
      // (index.html's own defaults), never as a bare URL.
      if (issue && issue.moderationStatus === 'Approved') {
        // Start the preview image now, not when the crawler comes back for it.
        ogImageService.warm(ogImageService.pickPreviewImage(issue.attachments));
        html = injectMeta(html, {
          title: issue.title,
          description: issue.description,
          type: 'article',
          // Hardcoded rather than built from req.get('host') — actonissues.blog and
          // actonissues.com both resolve to this same service (see the redirect
          // above), so a request that somehow reaches here on the old host must
          // still advertise the one canonical URL, not echo back whichever host
          // the crawler happened to use.
          url: `${CANONICAL_ORIGIN}/issues/${issue._id}`,
          image: `/og/issues/${issue._id}.jpg`
        });
      }
      res.send(injectAnalytics(html));
    } catch (err) {
      next();
    }
  });

  // Same idea as /issues/:id above — a blog post needs its own real
  // title/description in the raw HTML for crawlers, not the generic app
  // shell. A Draft article (or a slug that doesn't exist) falls through to
  // the plain SPA shell, same as an unapproved issue above.
  app.get('/articles/:slug', async (req, res, next) => {
    try {
      const Article = require('./models/Article');
      const article = await Article.findOne({ slug: req.params.slug, status: 'Published' })
        .select('title seoTitle excerpt seoDescription coverImage slug')
        .lean();
      let html = readIndexHtml();
      if (article) {
        ogImageService.warm(article.coverImage);
        html = injectMeta(html, {
          title: article.seoTitle || article.title,
          description: article.seoDescription || article.excerpt || '',
          type: 'article',
          url: `${CANONICAL_ORIGIN}/articles/${article.slug}`,
          image: `/og/articles/${encodeURIComponent(article.slug)}.jpg`
        });
      }
      res.send(injectAnalytics(html));
    } catch (err) {
      next();
    }
  });

  // Same idea as /articles/:slug above — a Super Admin-created custom page
  // (models/CustomPage.js) needs its own real title/description for
  // crawlers too. A Draft page (or a slug that doesn't exist) falls through
  // to the plain SPA shell, same as an unpublished article above.
  app.get('/p/:slug', async (req, res, next) => {
    try {
      const CustomPage = require('./models/CustomPage');
      const page = await CustomPage.findOne({ slug: req.params.slug, status: 'Published' })
        .select('title seoTitle seoDescription slug')
        .lean();
      let html = readIndexHtml();
      if (page) {
        html = injectMeta(html, {
          title: page.seoTitle || page.title,
          // A custom page has no photo of its own, so it shares the site card
          // — the same shape as every other link, just the branded artwork.
          description: page.seoDescription || 'Act On Issues — report and track civic issues in your community.',
          url: `${CANONICAL_ORIGIN}/p/${page.slug}`
        });
      }
      res.send(injectAnalytics(html));
    } catch (err) {
      next();
    }
  });

  // Same idea as /issues/:id and /articles/:slug above — a reporter's
  // public track record needs its own real title/description for crawlers
  // (and for whatever the person shares themselves). A disabled account or
  // unknown id falls through to the plain SPA shell.
  app.get('/reporters/:id', async (req, res, next) => {
    try {
      const User = require('./models/User');
      const Issue = require('./models/Issue');
      const user = await User.findOne({ _id: req.params.id, isDisabled: { $ne: true } })
        .select('name avatar')
        .lean();
      let html = readIndexHtml();
      if (user) {
        ogImageService.warm(user.avatar, { portrait: true });
        const [reported, resolved] = await Promise.all([
          Issue.countDocuments({ reporter: user._id, moderationStatus: 'Approved' }),
          Issue.countDocuments({ reporter: user._id, moderationStatus: 'Approved', status: 'Resolved' })
        ]);
        html = injectMeta(html, {
          title: user.name,
          description: `${user.name} has reported ${reported} civic issue${reported === 1 ? '' : 's'} on Act On Issues, ${resolved} resolved.`,
          type: 'profile',
          url: `${CANONICAL_ORIGIN}/reporters/${user._id}`,
          image: `/og/reporters/${user._id}.jpg`
        });
      }
      res.send(injectAnalytics(html));
    } catch (err) {
      next();
    }
  });

  // Same idea as /issues/:id above, but for the handful of static public
  // pages search engines actually need to index — search crawlers read the
  // raw HTML response, and without this every one of these routes would
  // serve the same generic title/description from index.html since the SPA
  // only sets a real per-page <title> after React mounts and runs.
  const PAGE_META = {
    '/': {
      title: 'Act On Issues — Report and Track Civic Issues',
      description: 'A social network for getting things fixed — report civic issues like water leaks, broken streetlights, and unsafe roads, track their status, and hold local authorities accountable.'
    },
    '/about': {
      title: 'About Us — Act On Issues',
      description: "Learn about Act On Issues' mission, vision, and how the platform helps citizens report and resolve everyday civic problems — plus a personal message from our founder on why it was built."
    },
    '/feed': {
      title: 'Browse Civic Issues — Act On Issues',
      description: 'Browse and search civic issues reported by citizens near you — water, electricity, roads, safety, and more.'
    },
    '/articles': {
      title: 'Guides & Resources — Act On Issues',
      description: 'Guides on reporting civic issues, getting community support, and escalating complaints to the right authority in India.'
    },
    '/terms': { title: 'Terms of Service — Act On Issues', description: 'Terms of Service for using the Act On Issues platform.' },
    '/legal': { title: 'Legal — Act On Issues', description: 'Legal information for the Act On Issues platform.' },
    '/privacy': { title: 'Privacy Policy — Act On Issues', description: 'How Act On Issues collects, uses, and protects your data.' }
  };

  app.get(Object.keys(PAGE_META), (req, res, next) => {
    // Express matches these routes case-insensitively, but PAGE_META keys
    // are exact-case — a differently-cased request (mostly bot traffic)
    // must fall through to the SPA catch-all instead of crashing here.
    const meta = PAGE_META[req.path.toLowerCase()];
    if (!meta) return next();
    // These titles already end in "— Act On Issues", so they're passed through
    // as the document title rather than getting the suffix appended twice.
    const html = injectMeta(readIndexHtml(), {
      title: meta.title,
      documentTitle: meta.title,
      description: meta.description,
      url: `${CANONICAL_ORIGIN}${req.path}`
    });
    res.send(injectAnalytics(html));
  });

  // Registered after the routes above so they win for '/' and the other
  // PAGE_META paths — express.static would otherwise auto-serve dist's
  // unmodified index.html for '/' itself (its default directory-index
  // behavior) before those routes ever got a chance to run.
  app.use(express.static(distDir));

  // SPA fallback for any non-API route. Reads + injects rather than
  // sendFile, same reason as every other index.html response above —
  // analytics scripts need to land in this HTML too.
  // A path the React router doesn't know gets a real 404 page rather than the
  // app shell with a 200 (which React then bounced to the homepage).
  app.get(/^(?!\/api).*/, (req, res) => {
    if (!errorPages.isSpaRoute(req.path)) return errorPages.sendErrorPage(res, 404);
    res.send(injectAnalytics(readIndexHtml()));
  });
}

// ---- 404 + error handling ----
app.use('/api', notFound);
// Anything else unmatched (e.g. no dist/ build in local dev, or a non-GET to a
// page URL): an HTML 404 for browsers, Express's default for everything else.
app.use((req, res, next) => {
  if (errorPages.wantsHtml(req)) return errorPages.sendErrorPage(res, 404);
  next();
});
app.use(errorHandler);

// Only claim a port when this file is what was run — `node server.js`, which
// is what the Dockerfile and `npm run dev` both do. The test suite imports
// this same file to exercise the real routes, middleware order and session
// handling rather than a stand-in assembled for testing, and a listener it
// never asked for would either collide with a running dev server or hang the
// run open after the tests finish.
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Act On Issues server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

module.exports = app;
