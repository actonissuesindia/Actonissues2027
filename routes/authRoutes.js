const router = require('express').Router();
const c = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');
const { otpLimiter, loginLimiter } = require('../middleware/security');
const upload = require('../middleware/upload');

router.get('/check-availability', c.checkAvailability);
router.post('/register-with-phone', c.registerWithPhone);
router.post('/login', loginLimiter, c.login);
router.post('/google', c.googleSignIn);
router.post('/firebase-phone', c.verifyFirebasePhone);
router.post('/logout', isAuthenticated, c.logout);
router.get('/me', c.me);
router.patch('/me', isAuthenticated, c.updateProfile);
router.patch('/me/language', isAuthenticated, c.updateLanguage);
router.post('/me/tour-seen', isAuthenticated, c.markWelcomeTourSeen);
router.patch('/me/user-id', isAuthenticated, c.updateUserId);
router.post('/me/avatar', isAuthenticated, upload.uploadImage.single('avatar'), c.uploadAvatar);
router.post('/me/banner', isAuthenticated, upload.uploadImage.single('banner'), c.uploadBanner);
router.post('/change-password', isAuthenticated, c.changePassword);

router.post('/otp/request', otpLimiter, c.requestOtp);
router.post('/otp/verify', c.verifyOtp);

router.post('/forgot-password', otpLimiter, c.forgotPassword);
router.post('/reset-password', c.resetPassword);

module.exports = router;
