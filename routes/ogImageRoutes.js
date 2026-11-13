const router = require('express').Router();
const c = require('../controllers/ogImageController');

// Public and unauthenticated by design — these URLs exist to be fetched by
// WhatsApp, Facebook, Telegram, Slack, Google and anyone else rendering a
// link preview. Mounted at /og (see server.js), ahead of the SPA catch-all.
//
// The .jpg suffix isn't decorative: some crawlers and caches decide how to
// treat a URL from its extension before they ever look at Content-Type.
router.get('/default.jpg', c.defaultCard);
router.get('/issues/:id.jpg', c.issueCard);
router.get('/articles/:slug.jpg', c.articleCard);
router.get('/reporters/:id.jpg', c.reporterCard);

module.exports = router;
