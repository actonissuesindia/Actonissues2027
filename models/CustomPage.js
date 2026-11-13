const mongoose = require('mongoose');

// A Super Admin-authored standalone page — its content lives entirely in
// PageBlock.js (page: `custom-<this _id>`, see models/PageBlock.js's PAGES
// validator), same freeform block types as About/Founder's Message
// (heading/richtext/image/button/cardgrid/spacer). This model just holds the
// page's identity (title/slug/status/SEO) — the thing that makes it linkable
// and publishable — not its content. Separate from Article.js: an Article is
// a dated blog post in a feed; a CustomPage is a standalone page (like
// About), just one a developer/Super Admin creates without writing code.
const CustomPageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true },
  publishedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Set the moment "Show in top navigation" is toggled on (customPageController.toggleNav)
  // — points at the Link-type PageBlock (page: 'topnav-links') this page created for
  // itself. Toggling off just hides that block (visible: false) rather than deleting it,
  // so toggling back on doesn't need to re-create it or lose its position in the nav order.
  navLinkBlockId: { type: mongoose.Schema.Types.ObjectId, ref: 'PageBlock', default: null }
}, { timestamps: true });

module.exports = mongoose.model('CustomPage', CustomPageSchema);
