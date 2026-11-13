const router = require('express').Router();
const c = require('../controllers/pushController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/vapid-public-key', c.publicKey);
router.post('/subscribe', isAuthenticated, c.subscribe);
router.post('/unsubscribe', isAuthenticated, c.unsubscribe);

module.exports = router;
