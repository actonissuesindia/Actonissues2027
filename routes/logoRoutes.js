const router = require('express').Router();
const { isAuthenticated, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const c = require('../controllers/logoController');

// Header/footer logo overrides are gated to stored role 'Admin' (the sole
// owner account, shown to users as "Super Admin") rather than authorizeStaff()
// — unlike the founder photo, both staff tiers shouldn't be able to touch
// site-wide branding.
router.get('/', c.get);
router.post('/:target', isAuthenticated, authorize('Admin'), upload.uploadImage.single('image'), c.upload);
router.delete('/:target', isAuthenticated, authorize('Admin'), c.remove);

module.exports = router;
