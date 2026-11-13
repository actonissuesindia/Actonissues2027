const router = require('express').Router();
const c = require('../controllers/customPageController');

// Public — GET /api/pages/:slug, published only. Admin read/write lives
// under /api/admin/pages (routes/adminRoutes.js), Super-Admin-only, same
// split as routes/articleRoutes.js.
router.get('/:slug', c.get);

module.exports = router;
