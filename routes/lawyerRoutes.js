const router = require('express').Router();
const c = require('../controllers/lawyerController');
const { isAuthenticated } = require('../middleware/auth');

// Order matters — '/me' must be registered before '/:id' or it would be
// swallowed as an :id lookup for the literal string "me".
router.get('/me', isAuthenticated, c.getMyProfile);
router.patch('/me', isAuthenticated, c.updateProfile);
router.get('/', c.list);
router.get('/:id', c.get);

module.exports = router;
