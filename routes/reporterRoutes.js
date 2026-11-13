const router = require('express').Router();
const c = require('../controllers/reporterController');

// Public — GET /api/reporters/:id, a citizen's shareable track record
// (report/resolved/supported counts, badges). No auth: the whole point is
// it works for a logged-out visitor, same as /api/articles.
router.get('/:id', c.getPublicProfile);

module.exports = router;
