const mongoose = require('mongoose');

// A minimal blog/article model for SEO content (how-to guides, category
// explainers, eventually per-city landing pages) — separate from
// PageBlock.js, which is a component library for fixed site chrome
// (Home/About/Footer/TopNav), not a CMS for long-form posts.
const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  excerpt: { type: String, trim: true },
  body: { type: String, required: true }, // sanitized HTML from RichTextEditor
  coverImage: String,
  tags: [{ type: String, trim: true }],
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
  authorName: { type: String, default: 'Act On Issues Team', trim: true },
  publishedAt: Date,
  // Optional overrides — fall back to title/excerpt when blank (see
  // server.js's per-article meta injection).
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Auto-generated via services/translationService.js the moment this
  // article is Published (skipped for Drafts — no point paying to
  // translate content that isn't public yet). Shape:
  // { hi: { title, excerpt, body, seoTitle, seoDescription }, te: {...}, ... }
  // — a language missing here (API not configured, or a call failed) just
  // means that language falls back to the English fields above, never a
  // blank field. See controllers/articleController.js.
  translations: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

ArticleSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Article', ArticleSchema);
