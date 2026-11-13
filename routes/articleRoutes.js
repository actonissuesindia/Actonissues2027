const router = require('express').Router();
const c = require('../controllers/articleController');

// Public — GET /api/articles (list) and /api/articles/:slug (detail),
// published only. Admin read/write lives under /api/admin/articles (see
// routes/adminRoutes.js), Super-Admin-only (authorize('Admin')), same split
// as routes/pageBlockRoutes.js.
router.get('/', c.list);
router.get('/:slug', c.get);

module.exports = router;
