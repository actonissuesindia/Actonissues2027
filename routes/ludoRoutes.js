const router = require('express').Router();
const c = require('../controllers/ludoController');
const { isAuthenticated } = require('../middleware/auth');
const { gameLimiter } = require('../middleware/security');

router.use(isAuthenticated, gameLimiter);

router.get('/enabled', c.enabled);

router.get('/active', c.requireGamesEnabled, c.getActiveRoom);
router.post('/rooms', c.requireGamesEnabled, c.createRoom);
router.get('/rooms/:code', c.requireGamesEnabled, c.getRoom);
router.post('/rooms/:code/join', c.requireGamesEnabled, c.joinRoom);
router.patch('/rooms/:code', c.requireGamesEnabled, c.patchRoom);
router.post('/rooms/:code/leave', c.requireGamesEnabled, c.leaveRoom);

module.exports = router;
