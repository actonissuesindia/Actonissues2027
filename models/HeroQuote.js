const mongoose = require('mongoose');

// Super Admin-only content: replaces the static "Your city. Your voice.
// Out loud." headline on the Home hero (src/pages/Home/Home.jsx) with one
// or more custom lines that auto-cycle, the same way AnnouncementBanner
// cycles through multiple announcements. Owner-only (see routes/adminRoutes.js
// — gated with authorize('Admin'), not authorizeStaff()) since this is the
// site's core tagline, not day-to-day moderation content.
const HeroQuoteSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 120 },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('HeroQuote', HeroQuoteSchema);
