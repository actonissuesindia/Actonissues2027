const mongoose = require('mongoose');

// Curated page-builder blocks — Super Admin only (stored role 'Admin'). One
// collection reused for every surface (Home/About/Founder's Message regions,
// Footer/TopNav links, Feed's toggle-only chrome): the `page` + `type` pair
// determines which config shape is valid and which types the admin UI even
// offers (see controllers/pageBlockController.js's ALLOWED_TYPES), not a
// separate schema per surface.
//
// `page` is a *region* within a page, not the whole page — a real page (e.g.
// About) mixes migrated block content with still-hardcoded live-data
// sections (stats, category chips), so each independently-replaceable chunk
// gets its own value here (e.g. 'about-values', 'about-how-it-works') rather
// than one flat bucket for the entire page. Grown incrementally as each
// milestone migrates its next region — not every value below is wired up to
// a page yet.
const PAGES = [
  'home-layout', 'home-how-it-works', 'home-cta-banner',
  'about-hero', 'about-what-we-do', 'about-how-it-works', 'about-values', 'about-mission-vision', 'about-neutrality-legal',
  'founder-message-body', 'founder-mission-vision',
  'footer-platform', 'footer-account', 'footer-legal',
  'topnav-links',
  'feed-toggles',
  // Throwaway value for exercising drag/CRUD end-to-end before any real
  // page is migrated (see docs/DEPLOYMENT.md-style milestone notes) — not
  // rendered anywhere on the live site.
  'test'
];

const TYPES = ['heading', 'richtext', 'image', 'button', 'cardgrid', 'spacer', 'link', 'toggle'];

// A fixed PAGES value, or `custom-<CustomPage _id>` for a Super
// Admin-created standalone page (models/CustomPage.js) — those are created
// dynamically, so they can't be a fixed enum entry the way the hand-coded
// pages above are. controllers/pageBlockController.js still authoritatively
// checks a 'custom-' page id actually corresponds to a real CustomPage
// document before allowing writes to it.
const isValidPage = (value) => PAGES.includes(value) || /^custom-[a-f0-9]{24}$/.test(value);

const PageBlockSchema = new mongoose.Schema({
  page: { type: String, required: true, index: true, validate: { validator: isValidPage, message: props => `${props.value} is not a valid page` } },
  type: { type: String, enum: TYPES, required: true },
  order: { type: Number, required: true, default: 0 },
  visible: { type: Boolean, default: true },
  // Every block starts locked — Super Admin has to explicitly unlock one
  // before its delete button even appears, so a block is never one
  // accidental click away from being removed. A UI guardrail (hides the
  // delete control in the admin panel), not a security boundary; the API
  // itself still enforces it server-side in the remove() controller.
  locked: { type: Boolean, default: true },
  // Freeform per-type payload, validated against a per-type shape in the
  // controller rather than a Mongoose discriminator — the shape differs
  // enough per `type` that a discriminator buys little over branching on
  // `type` once in the controller (which the renderer/form maps need anyway).
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Auto-generated via services/translationService.js — only the
  // translatable strings for this block's `type` (see
  // controllers/pageBlockController.js's extractTranslatable/applyTranslated),
  // not a full copy of `config`, since fields like href/icon/shape are never
  // language-dependent. A language missing here just falls back to the
  // English `config` values, never a blank field.
  translations: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

PageBlockSchema.index({ page: 1, order: 1 });

module.exports = mongoose.model('PageBlock', PageBlockSchema);
module.exports.PAGES = PAGES;
module.exports.TYPES = TYPES;
