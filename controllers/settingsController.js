const SystemSetting = require('../models/SystemSetting');

const DEFAULTS = [
  { key: 'APP_NAME', value: 'Act On Issues', description: 'Application display name' },
  { key: 'SMTP_ENABLED', value: 'true', description: 'Send email notifications' },
  { key: 'GCS_ENABLED', value: 'false', description: 'Store uploads in Google Cloud Storage' },
  { key: 'AUTO_APPROVAL_ENABLED', value: 'true', description: 'Automatically approve a post if nobody reviews it in time' },
  { key: 'GAMES_ENABLED', value: 'true', description: 'Show the Games tab and allow access to Ludo (local and online)' },
  { key: 'AUTO_APPROVAL_DAYS', value: '1', description: 'Days to wait before auto-approving an unreviewed post (combine with hours/minutes below)' },
  { key: 'AUTO_APPROVAL_HOURS', value: '0', description: 'Hours, added to the days above' },
  { key: 'AUTO_APPROVAL_MINUTES', value: '0', description: 'Minutes, added to the days/hours above' },
  { key: 'HERO_EYEBROW_TEXT', value: '', description: 'Overrides the small line above the Home hero headline ("A social network for getting things fixed"). Leave blank to use the default.' },
  { key: 'HERO_DESCRIPTION_TEXT', value: '', description: 'Overrides the paragraph below the Home hero headline. Leave blank to use the default.' }
];

// Superseded by AUTO_APPROVAL_DAYS/HOURS/MINUTES (which combine, e.g. "1 day
// 2 hours 15 minutes") — deleted on next settings load so they don't linger
// as orphaned rows in the generic settings list. BLOB_WAVE_FAST and
// FOUNDER_WAVE_SPEED were short-lived wobble-speed toggles for the Founders
// page photo, dropped when that page reverted to a plain round photo.
const RETIRED_KEYS = ['AUTO_APPROVAL_VALUE', 'AUTO_APPROVAL_UNIT', 'BLOB_WAVE_FAST', 'FOUNDER_WAVE_SPEED'];

// GET /api/admin/settings
exports.index = async (req, res, next) => {
  try {
    // Add any default that doesn't exist yet — upsert-if-missing rather than
    // only seeding on a totally empty collection, so new defaults introduced
    // later still show up on an existing, already-partially-seeded install
    // instead of silently never appearing.
    await Promise.all(DEFAULTS.map(d =>
      SystemSetting.updateOne({ key: d.key }, { $setOnInsert: d }, { upsert: true })
    ));
    await SystemSetting.deleteMany({ key: { $in: RETIRED_KEYS } });
    const settings = await SystemSetting.find().sort({ key: 1 });
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/settings  body: { settings: [{key, value}] }
exports.save = async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body.settings) ? req.body.settings : [];
    await Promise.all(updates.map(s =>
      SystemSetting.findOneAndUpdate(
        { key: s.key },
        { value: s.value },
        { upsert: true, new: true }
      )
    ));
    const settings = await SystemSetting.find().sort({ key: 1 });
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
};
