const router = require('express').Router();
const { isAuthenticated, authorizeStaff } = require('../middleware/auth');
const upload = require('../middleware/upload');
const c = require('../controllers/founderImageController');

router.get('/', c.get);
router.post('/', isAuthenticated, authorizeStaff(), upload.uploadImage.single('image'), c.upload);
router.delete('/', isAuthenticated, authorizeStaff(), c.remove);

module.exports = router;
