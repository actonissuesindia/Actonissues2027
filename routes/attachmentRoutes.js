const router = require('express').Router();
const upload = require('../middleware/upload');
const c = require('../controllers/attachmentController');
const { isAuthenticated } = require('../middleware/auth');

router.post('/:issueId', isAuthenticated, upload.array('attachments', 6), c.upload);
router.delete('/:issueId/:attachmentId', isAuthenticated, c.remove);

module.exports = router;
