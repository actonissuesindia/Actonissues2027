const PushSubscription = require('../models/PushSubscription');
const pushService = require('../services/pushService');

// GET /api/push/vapid-public-key  (public — the frontend needs this before
// it can even ask the browser to subscribe)
exports.publicKey = (req, res) => {
  const key = pushService.getPublicKey();
  if (!key) return res.status(503).json({ success: false, message: 'Push notifications are not configured' });
  res.json({ success: true, publicKey: key });
};

// POST /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
// Upserts on endpoint so re-subscribing (e.g. after clearing site data)
// never creates a duplicate row, and correctly re-links an endpoint that
// moved to a different account on a shared device.
exports.subscribe = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ success: false, message: 'A valid push subscription is required' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user._id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/push/unsubscribe  { endpoint }
exports.unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
