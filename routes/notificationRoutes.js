const router = require('express').Router();
const c = require('../controllers/notificationController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, c.list);
router.post('/read-all', isAuthenticated, c.markAllRead);
router.post('/:id/read', isAuthenticated, c.markRead);

module.exports = router;
