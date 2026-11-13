const router = require('express').Router();
const c = require('../controllers/pageBlockController');

// Public — GET /api/page-blocks?page=<region>, visible blocks only. Admin
// read/write lives under /api/admin/page-blocks (see routes/adminRoutes.js),
// Super-Admin-only (authorize('Admin')).
router.get('/', c.list);

module.exports = router;
