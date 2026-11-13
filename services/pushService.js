const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let configured = false;

// Lazily configures VAPID, same lazy pattern as firebaseAdminService — a
// missing key pair should never crash the server at boot, only surface when
// a push is actually attempted.
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:no-reply@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

exports.getPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

// Sends to every device/browser this user has subscribed from. Best-effort:
// a dead subscription (browser uninstalled it, endpoint expired) is removed
// instead of retried; any other delivery error is swallowed so a push
// failure never breaks the caller's main flow (e.g. creating an issue).
exports.sendPush = async (userId, { title, message, link, image }) => {
  if (!ensureConfigured()) return;
  const subs = await PushSubscription.find({ user: userId });
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body: message, url: link, image });
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id });
      } else {
        console.error('Push delivery failed:', err.message);
      }
    }
  }));
};
