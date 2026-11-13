const SystemSetting = require('../models/SystemSetting');

// Only touch GCS when it's actually configured — same lazy-require pattern
// as founderImageController's photo upload.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

// Header (navbar) and footer logos are independent overrides — a site can
// want a compact icon-only mark up top and the full wordmark in the footer,
// so each gets its own key/value row rather than sharing one.
const KEYS = { header: 'HEADER_LOGO_URL', footer: 'FOOTER_LOGO_URL' };

// GET /api/logo (public) — blank means "no override", and the frontend
// falls back to its bundled default logo for that slot.
exports.get = async (req, res, next) => {
  try {
    const rows = await SystemSetting.find({ key: { $in: Object.values(KEYS) } });
    const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ success: true, header: byKey[KEYS.header] || '', footer: byKey[KEYS.footer] || '' });
  } catch (err) {
    next(err);
  }
};

// POST /api/logo/:target (multipart, field "image", Super Admin only — stored role 'Admin')
exports.upload = async (req, res, next) => {
  try {
    const key = KEYS[req.params.target];
    if (!key) return res.status(400).json({ success: false, message: 'Invalid logo target' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = useGCS ? (await gcs.uploadFile(req.file)).url : '/uploads/' + req.file.filename;
    await SystemSetting.findOneAndUpdate({ key }, { value: url }, { upsert: true });
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/logo/:target (Super Admin only) — reverts that slot back to the bundled default
exports.remove = async (req, res, next) => {
  try {
    const key = KEYS[req.params.target];
    if (!key) return res.status(400).json({ success: false, message: 'Invalid logo target' });
    await SystemSetting.findOneAndUpdate({ key }, { value: '' }, { upsert: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
