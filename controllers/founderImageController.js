const SystemSetting = require('../models/SystemSetting');

// Only touch GCS when it's actually configured — same lazy-require pattern
// as authController's avatar/banner upload.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

// Single site-wide photo (Founder's Message page), stored as a plain URL in
// the generic key/value settings collection rather than its own model —
// there's only ever one value, not a list like HeroQuote.
const KEY = 'FOUNDER_IMAGE_URL';

// GET /api/founder-image (public)
exports.get = async (req, res, next) => {
  try {
    const photo = await SystemSetting.findOne({ key: KEY });
    res.json({ success: true, url: photo?.value || '' });
  } catch (err) {
    next(err);
  }
};

// POST /api/founder-image (multipart, field "image", staff only — stored role 'Admin' or 'Authority')
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = useGCS ? (await gcs.uploadFile(req.file)).url : '/uploads/' + req.file.filename;
    await SystemSetting.findOneAndUpdate({ key: KEY }, { value: url }, { upsert: true });
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/founder-image (staff only) — reverts the page back to the placeholder
exports.remove = async (req, res, next) => {
  try {
    await SystemSetting.findOneAndUpdate({ key: KEY }, { value: '' }, { upsert: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
