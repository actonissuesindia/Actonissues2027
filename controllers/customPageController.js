const CustomPage = require('../models/CustomPage');
const PageBlock = require('../models/PageBlock');
const { slugify, generateUniqueSlug } = require('../utils/slugify');

// GET /api/pages/:slug — public, published only. The page's own content is
// fetched separately by the frontend via GET /api/page-blocks?page=custom-<id>
// (same call every other Page Builder-driven page already makes) — this
// endpoint only resolves slug -> id/SEO metadata.
exports.get = async (req, res, next) => {
  try {
    const page = await CustomPage.findOne({ slug: req.params.slug, status: 'Published' }).lean();
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, page });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/pages — Super Admin only, every status. Populates just the
// `visible` field of the nav-link block (if one exists) so the admin panel
// can render the "Show in top navigation" toggle in its actual current
// state without a second round trip per page.
exports.adminList = async (req, res, next) => {
  try {
    const pages = await CustomPage.find().sort({ updatedAt: -1 }).populate('navLinkBlockId', 'visible').lean();
    res.json({ success: true, pages });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/pages
exports.create = async (req, res, next) => {
  try {
    const { title, status, seoTitle, seoDescription, slug } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });

    const finalSlug = await generateUniqueSlug(CustomPage, slug || title);
    const isPublished = status === 'Published';

    const page = await CustomPage.create({
      title: title.trim(),
      slug: finalSlug,
      status: isPublished ? 'Published' : 'Draft',
      seoTitle: seoTitle?.trim(),
      seoDescription: seoDescription?.trim(),
      publishedAt: isPublished ? new Date() : undefined,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    res.status(201).json({ success: true, page });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/pages/:id — the slug only changes if `slug` is explicitly
// sent (via slugify + collision check), same as Article.update — a title
// edit alone never silently changes the URL.
exports.update = async (req, res, next) => {
  try {
    const page = await CustomPage.findById(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    const { title, status, seoTitle, seoDescription, slug } = req.body;
    if (title !== undefined) page.title = title.trim();
    if (seoTitle !== undefined) page.seoTitle = seoTitle.trim();
    if (seoDescription !== undefined) page.seoDescription = seoDescription.trim();
    if (slug !== undefined && slugify(slug) !== page.slug) {
      page.slug = await generateUniqueSlug(CustomPage, slug, page._id);
    }
    if (status !== undefined && status !== page.status) {
      page.status = status;
      if (status === 'Published' && !page.publishedAt) page.publishedAt = new Date();
    }
    page.updatedBy = req.user._id;

    await page.save();

    // Keep an existing nav link pointed at this page's current title/slug —
    // otherwise renaming the page or changing its slug after "Show in top
    // navigation" was switched on would silently leave a stale label/URL.
    if (page.navLinkBlockId) {
      await PageBlock.updateOne(
        { _id: page.navLinkBlockId },
        { $set: { 'config.label': page.title, 'config.href': `/p/${page.slug}`, updatedBy: req.user._id } }
      );
    }

    res.json({ success: true, page });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/pages/:id/toggle-nav — flips whether this page has a link
// in TopNav. The first toggle-on creates a Link-type PageBlock on
// 'topnav-links' (see models/PageBlock.js); every toggle after that just
// flips its `visible` flag, so switching it off and back on doesn't lose its
// position in the nav order or require re-entering anything.
exports.toggleNav = async (req, res, next) => {
  try {
    const page = await CustomPage.findById(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    let block = page.navLinkBlockId ? await PageBlock.findById(page.navLinkBlockId) : null;

    if (!block) {
      const last = await PageBlock.findOne({ page: 'topnav-links' }).sort({ order: -1 });
      block = await PageBlock.create({
        page: 'topnav-links',
        type: 'link',
        order: (last?.order ?? -1) + 1,
        visible: true,
        locked: false,
        config: { label: page.title, href: `/p/${page.slug}`, requiresAuth: false },
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      page.navLinkBlockId = block._id;
    } else {
      block.visible = !block.visible;
      block.updatedBy = req.user._id;
      await block.save();
    }

    await page.save();
    res.json({ success: true, inNav: block.visible });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/pages/:id — also cleans up its PageBlock content
// (page: `custom-<id>`), since those blocks are meaningless once nothing can
// resolve to this page's slug anymore, unlike a locked block on a fixed
// region which the delete endpoint protects.
exports.remove = async (req, res, next) => {
  try {
    const page = await CustomPage.findById(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    await page.deleteOne();
    await PageBlock.deleteMany({ page: `custom-${page._id}` });
    if (page.navLinkBlockId) await PageBlock.deleteOne({ _id: page.navLinkBlockId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
