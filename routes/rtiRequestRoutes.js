const router = require('express').Router();
const c = require('../controllers/rtiRequestController');
const upload = require('../middleware/upload');
const { isAuthenticated } = require('../middleware/auth');

router.get('/meta', c.meta);
router.get('/', isAuthenticated, c.list);
router.get('/:id', isAuthenticated, c.get);

router.post('/', isAuthenticated, c.create);
router.post('/:id/claim', isAuthenticated, c.claim);
router.patch('/:id/assign', isAuthenticated, c.assign);
router.post('/:id/quote', isAuthenticated, c.quote);
router.post('/:id/decline', isAuthenticated, c.decline);
router.post('/:id/notes', isAuthenticated, c.addNote);
router.post('/:id/decision', isAuthenticated, c.decision);
router.post('/:id/file', isAuthenticated, c.markFiled);
router.post('/:id/resolve', isAuthenticated, upload.array('attachments', 6), c.resolve);
router.post('/:id/cancel', isAuthenticated, c.cancel);
router.post('/:id/attachments', isAuthenticated, upload.array('attachments', 6), c.uploadAttachment);
router.delete('/:id/attachments/:attachmentId', isAuthenticated, c.removeAttachment);

module.exports = router;
