const Article = require('../models/Article');
const { sanitizeHtml } = require('../services/emailTemplate');
const { slugify, generateUniqueSlug } = require('../utils/slugify');
const { translateFields } = require('../services/translationService');

const LIST_FIELDS = 'title slug excerpt coverImage tags publishedAt translations';
const TRANSLATABLE_FIELDS = ['title', 'excerpt', 'body', 'seoTitle', 'seoDescription'];

// Fires the translation batch and saves the result — awaited by callers so
// the admin sees "Published" only once translations are ready (a few
// seconds, acceptable for a publish action, not a hot path). Never throws:
// a translation failure shouldn't block publishing the English content.
// Exported (alongside the route handlers below) so scripts/translateExistingContent.js
// can reuse this exact logic to backfill content that was created before
// this feature existed — e.g. via a seed script that calls Article.create()
// directly rather than going through exports.create below.
exports.refreshTranslations = refreshTranslations;
async function refreshTranslations(article) {
  try {
    const fields = {};
    TRANSLATABLE_FIELDS.forEach(f => { if (article[f]) fields[f] = article[f]; });
    article.translations = await translateFields(fields);
    await article.save();
  } catch (err) {
    console.error(`Failed to translate article ${article._id}:`, err.message);
  }
}

// Overlays the requested language's translated fields onto a lean article
// object, falling back to English per-field (never a blank field) when a
// translation is missing — API not configured, call failed, or just not
// generated yet. A no-op for 'en' or when no ?lang= was given.
function applyLang(article, lang) {
  if (!lang || lang === 'en' || !article.translations?.[lang]) return article;
  const t = article.translations[lang];
  const result = { ...article };
  TRANSLATABLE_FIELDS.forEach(f => { if (t[f]) result[f] = t[f]; });
  return result;
}

// GET /api/articles — public, published only, newest first.
exports.list = async (req, res, next) => {
  try {
    const articles = await Article.find({ status: 'Published' })
      .select(LIST_FIELDS)
      .sort({ publishedAt: -1 })
      .lean();
    res.json({ success: true, articles: articles.map(a => applyLang(a, req.query.lang)) });
  } catch (err) {
    next(err);
  }
};

// GET /api/articles/:slug — public, published only (a draft/unpublished
// slug 404s here even for staff — they read it from the admin list instead).
exports.get = async (req, res, next) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug, status: 'Published' }).lean();
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    res.json({ success: true, article: applyLang(article, req.query.lang) });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/articles — Super Admin only (see routes/adminRoutes.js), every status.
exports.adminList = async (req, res, next) => {
  try {
    const articles = await Article.find()
      .sort({ updatedAt: -1 })
      .populate('createdBy', 'name')
      .lean();
    res.json({ success: true, articles });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/articles
exports.create = async (req, res, next) => {
  try {
    const { title, excerpt, body, coverImage, tags, status, authorName, seoTitle, seoDescription, slug } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: 'Body is required' });

    const finalSlug = await generateUniqueSlug(Article, slug || title);
    const isPublished = status === 'Published';

    const article = await Article.create({
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt?.trim(),
      body: sanitizeHtml(body),
      coverImage,
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      status: isPublished ? 'Published' : 'Draft',
      authorName: authorName?.trim() || undefined,
      publishedAt: isPublished ? new Date() : undefined,
      seoTitle: seoTitle?.trim(),
      seoDescription: seoDescription?.trim(),
      createdBy: req.user._id
    });

    if (isPublished) await refreshTranslations(article);

    res.status(201).json({ success: true, article });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/articles/:id — the slug only changes if `slug` is
// explicitly sent in this request (via slugify + collision check); a title
// edit alone never silently changes the URL, since that would break
// whatever already links/ranks for the old one.
exports.update = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    const { title, excerpt, body, coverImage, tags, status, authorName, seoTitle, seoDescription, slug } = req.body;
    if (title !== undefined) article.title = title.trim();
    if (excerpt !== undefined) article.excerpt = excerpt.trim();
    if (body !== undefined) article.body = sanitizeHtml(body);
    if (coverImage !== undefined) article.coverImage = coverImage;
    if (tags !== undefined) article.tags = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (authorName !== undefined) article.authorName = authorName.trim() || 'Act On Issues Team';
    if (seoTitle !== undefined) article.seoTitle = seoTitle.trim();
    if (seoDescription !== undefined) article.seoDescription = seoDescription.trim();
    if (slug !== undefined && slugify(slug) !== article.slug) {
      article.slug = await generateUniqueSlug(Article, slug, article._id);
    }
    if (status !== undefined && status !== article.status) {
      article.status = status;
      if (status === 'Published' && !article.publishedAt) article.publishedAt = new Date();
    }

    await article.save();
    // Re-translates whenever a Published article is saved — cheap
    // idempotent refresh if nothing textual actually changed, and correctly
    // catches up a Draft the moment it's switched to Published.
    if (article.status === 'Published') await refreshTranslations(article);

    res.json({ success: true, article });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/articles/:id
exports.remove = async (req, res, next) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    await article.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
