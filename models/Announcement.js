const mongoose = require('mongoose');

// Drives which emoji + animation the banner shows (see
// src/utils/announcementMoods.js on the frontend for the emoji/label
// mapping and src/components/common/AnnouncementBanner.jsx for the
// per-mood animation, e.g. a confetti burst for 'celebrate').
const MOODS = ['announce', 'celebrate', 'warning', 'sad', 'love'];

// Admin/Authority can post any number of these — each is its own record,
// editable/deletable independently (see controllers/announcementController.js).
// The Home page banner (AnnouncementBanner.jsx) cycles through whichever
// ones still exist; deleting one here removes it from the banner immediately.
const AnnouncementSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 280 },
  mood: { type: String, enum: MOODS, default: 'announce' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Both optional — unset startAt means "visible immediately", unset endAt
  // means "visible until deleted" (today's default behavior). The public
  // list (GET /api/announcements, what the Home banner cycles through)
  // only returns ones currently inside this window; the admin list
  // (GET /api/admin/announcements) returns everything regardless, so
  // scheduled-for-later or already-expired ones stay visible to edit.
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
module.exports.MOODS = MOODS;
