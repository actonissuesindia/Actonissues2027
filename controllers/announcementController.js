const Announcement = require('../models/Announcement');

// GET /api/announcements  (public — cycled through on the Home page banner)
// Only returns announcements currently inside their [startAt, endAt] window
// — unset startAt/endAt means "no lower/upper bound" respectively, so a
// plain announcement with neither set (today's default) always matches.
exports.list = async (req, res, next) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] }
      ]
    }).sort({ createdAt: -1 }).populate('postedBy', 'name role');
    res.json({ success: true, announcements });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/announcements  (staff — every announcement regardless of
// its schedule, so a not-yet-active or already-expired one can still be
// found and edited/deleted from the Announcements tab)
exports.adminList = async (req, res, next) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).populate('postedBy', 'name role');
    res.json({ success: true, announcements });
  } catch (err) {
    next(err);
  }
};

function validateText(text, res) {
  if (!text) {
    res.status(400).json({ success: false, message: 'Announcement text is required' });
    return null;
  }
  if (text.length > 280) {
    res.status(400).json({ success: false, message: 'Keep it under 280 characters' });
    return null;
  }
  return text;
}

// Falls back to the default mood on anything not in the known list, rather
// than rejecting the request — an emoji/mood is decoration, not something
// worth failing the whole save over.
function resolveMood(mood) {
  return Announcement.MOODS.includes(mood) ? mood : 'announce';
}

// Parses an optional datetime-local string into a Date, or null if blank/
// invalid — never throws, since "no schedule bound" is a valid, common case.
function parseOptionalDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateWindow(startAt, endAt, res) {
  if (startAt && endAt && startAt >= endAt) {
    res.status(400).json({ success: false, message: '"Visible until" must be after "Visible from"' });
    return false;
  }
  return true;
}

// POST /api/admin/announcements  (Admin or Authority — either can post,
// not scoped to Citizen-only like most other user-management actions,
// since this is a site-wide broadcast rather than an action on an account)
exports.create = async (req, res, next) => {
  try {
    const text = validateText((req.body.text || '').trim(), res);
    if (!text) return;
    const startAt = parseOptionalDate(req.body.startAt);
    const endAt = parseOptionalDate(req.body.endAt);
    if (!validateWindow(startAt, endAt, res)) return;

    let announcement = await Announcement.create({ text, mood: resolveMood(req.body.mood), startAt, endAt, postedBy: req.user._id });
    announcement = await announcement.populate('postedBy', 'name role');
    res.status(201).json({ success: true, announcement });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/announcements/:id
exports.update = async (req, res, next) => {
  try {
    const text = validateText((req.body.text || '').trim(), res);
    if (!text) return;
    const startAt = parseOptionalDate(req.body.startAt);
    const endAt = parseOptionalDate(req.body.endAt);
    if (!validateWindow(startAt, endAt, res)) return;

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { text, mood: resolveMood(req.body.mood), startAt, endAt },
      { new: true }
    ).populate('postedBy', 'name role');
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, announcement });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/announcements/:id
exports.remove = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
