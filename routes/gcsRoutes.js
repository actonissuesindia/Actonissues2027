const router = require('express').Router();
const upload = require('../middleware/upload');
const controller = require('../controllers/gcsController');
const { isAuthenticated } = require('../middleware/auth');

router.post('/upload', isAuthenticated, upload.single('file'), controller.upload);

module.exports = router;
