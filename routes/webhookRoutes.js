const router = require('express').Router();
const c = require('../controllers/webhookController');

// POST /api/webhooks/brevo-inbound/:secret — see docs/DEPLOYMENT.md Step 17.
// The secret is a URL segment rather than a header check because Brevo's
// inbound-parsing setup only lets you configure a plain webhook URL.
router.post('/brevo-inbound/:secret', (req, res, next) => {
  if (!process.env.WEBHOOK_INBOUND_SECRET || req.params.secret !== process.env.WEBHOOK_INBOUND_SECRET) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
}, c.brevoInbound);

module.exports = router;
