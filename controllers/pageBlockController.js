const PageBlock = require('../models/PageBlock');
const { translateFields } = require('../services/translationService');

// Matches models/PageBlock.js's own isValidPage — a Super Admin-created
// CustomPage's blocks live under `custom-<CustomPage _id>` rather than a
// fixed PAGES entry, since those pages are created dynamically at runtime.
const CUSTOM_PAGE_RE = /^custom-[a-f0-9]{24}$/;
const isKnownPage = (page) => PageBlock.PAGES.includes(page) || CUSTOM_PAGE_RE.test(page);
// Every custom page gets the same freeform block palette as About/Founder's
// Message — there's no separate ALLOWED_TYPES entry per custom page since
// they're all the same kind of "long-form content" region.
const allowedTypesFor = (page) => (CUSTOM_PAGE_RE.test(page) ? FREEFORM_TYPES : ALLOWED_TYPES[page]);

// Only touch GCS when it's actually configured — same lazy-require pattern
// as founderImageController's photo upload.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

// Which block types each page/region may contain — enforced server-side
// (not just hidden in the admin UI) so a crafted request can't put a
// rich-text block on Footer, or a Link block with an arbitrary `group` on a
// page that doesn't use one. Keyed by exact page value rather than a prefix
// guess, so adding a new region later is an explicit, reviewable line here.
const FREEFORM_TYPES = ['heading', 'richtext', 'image', 'button', 'cardgrid', 'spacer'];
const ALLOWED_TYPES = {
  'home-layout': ['toggle'],
  'home-how-it-works': FREEFORM_TYPES,
  'home-cta-banner': FREEFORM_TYPES,
  'about-hero': FREEFORM_TYPES,
  'about-what-we-do': FREEFORM_TYPES,
  'about-how-it-works': FREEFORM_TYPES,
  'about-values': FREEFORM_TYPES,
  'about-mission-vision': FREEFORM_TYPES,
  'about-neutrality-legal': FREEFORM_TYPES,
  'founder-message-body': FREEFORM_TYPES,
  'footer-platform': ['link'],
  'footer-account': ['link'],
  'footer-legal': ['link'],
  'topnav-links': ['link'],
  'feed-toggles': ['toggle'],
  // Foundation milestone's throwaway page — every type allowed so drag/CRUD
  // can be exercised before any real page is migrated.
  test: [...FREEFORM_TYPES, 'link', 'toggle']
};

// Feed's chrome toggles are a fixed, seeded-once set — the admin UI never
// lets Super Admin add/remove one, only flip `visible`, but the controller
// still checks this so a crafted POST can't invent a 6th toggle key.
// Feed's chrome toggles, plus Home's live-data section placeholders (order +
// show/hide only — their actual content comes from live data, not editable
// block config, so 'toggle' is reused here rather than adding a new type).
const TOGGLE_KEYS = [
  'search', 'locationFilter', 'tagsSidebar', 'fab', 'scrollTop',
  'hotTopicsCarousel', 'latestIssues', 'trendingChips', 'topVoices', 'howItWorks', 'ctaBanner', 'realImpact'
];

// Returns an error string, or null if `config` is a valid shape for `type`.
// Deliberately permissive about extra/optional fields — this only rejects
// configs missing what the renderer/form actually needs, not full JSON
// Schema validation.
function validateConfig(type, config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return 'config must be an object';
  switch (type) {
    case 'heading':
      if (typeof config.text !== 'string' || !config.text.trim()) return 'heading requires config.text';
      if (config.level && !['h1', 'h2'].includes(config.level)) return 'heading.level must be h1 or h2';
      return null;
    case 'richtext':
      if (!Array.isArray(config.paragraphs) || !config.paragraphs.every(p => typeof p === 'string')) {
        return 'richtext requires config.paragraphs as a string array';
      }
      return null;
    case 'image':
      if (typeof config.url !== 'string' || !config.url.trim()) return 'image requires config.url';
      return null;
    case 'button':
      if (typeof config.text !== 'string' || !config.text.trim()) return 'button requires config.text';
      if (typeof config.href !== 'string' || !config.href.trim()) return 'button requires config.href';
      return null;
    case 'cardgrid':
      if (typeof config.colClass !== 'string' || !config.colClass.trim()) return 'cardgrid requires config.colClass';
      if (!Array.isArray(config.items) || !config.items.every(i => i && typeof i.title === 'string' && typeof i.text === 'string')) {
        return 'cardgrid requires config.items as [{title, text}]';
      }
      return null;
    case 'spacer':
      if (typeof config.height !== 'number' || config.height < 0) return 'spacer requires config.height as a non-negative number';
      return null;
    case 'link':
      if (typeof config.label !== 'string' || !config.label.trim()) return 'link requires config.label';
      if (typeof config.href !== 'string' || !config.href.trim()) return 'link requires config.href';
      return null;
    case 'toggle':
      if (!TOGGLE_KEYS.includes(config.key)) return `toggle.key must be one of ${TOGGLE_KEYS.join(', ')}`;
      if (typeof config.label !== 'string' || !config.label.trim()) return 'toggle requires config.label';
      return null;
    default:
      return `unknown type ${type}`;
  }
}

// Pulls out only the strings worth machine-translating for a given block
// type — everything else in `config` (href, icon, shape, colClass, ...) is
// never language-dependent. Keyed with short synthetic names (p0, p1, ...
// for richtext paragraphs; item0Title, item0Text, ... for cardgrid) so a
// single flat object can round-trip through translateFields() regardless of
// how many paragraphs/items a given block happens to have.
function extractTranslatable(type, config) {
  switch (type) {
    case 'heading':
      return { text: config.text, eyebrow: config.eyebrow };
    case 'richtext':
      return Object.fromEntries((config.paragraphs || []).map((p, i) => [`p${i}`, p]));
    case 'button':
      return { text: config.text };
    case 'cardgrid': {
      const fields = { heading: config.heading };
      (config.items || []).forEach((item, i) => {
        fields[`item${i}Title`] = item.title;
        fields[`item${i}Text`] = item.text;
      });
      return fields;
    }
    case 'link':
      return { label: config.label };
    default:
      // image/spacer/toggle have nothing translatable — toggle's `label` is
      // the admin-facing Page Builder control name, not citizen-facing.
      return {};
  }
}

// Reassembles a translated `config` for rendering — falls back to the
// original English value per-field (never blank) when a specific piece
// wasn't translated (missing language, or the block was edited after
// translations were generated for an old paragraph count, etc.).
function applyTranslated(type, config, translated) {
  if (!translated) return config;
  switch (type) {
    case 'heading':
      return { ...config, text: translated.text || config.text, eyebrow: translated.eyebrow ?? config.eyebrow };
    case 'richtext':
      return { ...config, paragraphs: (config.paragraphs || []).map((p, i) => translated[`p${i}`] || p) };
    case 'button':
      return { ...config, text: translated.text || config.text };
    case 'cardgrid':
      return {
        ...config,
        heading: translated.heading ?? config.heading,
        items: (config.items || []).map((item, i) => ({
          ...item,
          title: translated[`item${i}Title`] || item.title,
          text: translated[`item${i}Text`] || item.text
        }))
      };
    case 'link':
      return { ...config, label: translated.label || config.label };
    default:
      return config;
  }
}

// Fires the translation batch and saves the result — awaited so a block is
// never returned to a visitor mid-translation with a half-written state.
// Never throws: a translation failure shouldn't block saving the English
// content, which is what actually matters for the block to work at all.
// Exported so scripts/translateExistingContent.js can backfill blocks that
// were created before this feature existed.
exports.refreshTranslations = refreshTranslations;
async function refreshTranslations(block) {
  try {
    const fields = extractTranslatable(block.type, block.config);
    if (Object.keys(fields).length === 0) return;
    block.translations = await translateFields(fields);
    await block.save();
  } catch (err) {
    console.error(`Failed to translate page block ${block._id}:`, err.message);
  }
}

// GET /api/page-blocks?page=X (public) — only what visitors should see.
exports.list = async (req, res, next) => {
  try {
    const { page, lang } = req.query;
    if (!page || !isKnownPage(page)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing page' });
    }
    const blocks = await PageBlock.find({ page, visible: true }).sort({ order: 1 }).lean();
    const localized = lang && lang !== 'en'
      ? blocks.map(b => ({ ...b, config: applyTranslated(b.type, b.config, b.translations?.[lang]) }))
      : blocks;
    res.json({ success: true, blocks: localized });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/page-blocks?page=X (Super Admin) — every block regardless
// of visibility, so hidden-but-not-deleted blocks can still be found/edited.
exports.adminList = async (req, res, next) => {
  try {
    const { page } = req.query;
    if (!page || !isKnownPage(page)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing page' });
    }
    const blocks = await PageBlock.find({ page }).sort({ order: 1 });
    res.json({ success: true, blocks });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/page-blocks
exports.create = async (req, res, next) => {
  try {
    const { page, type, config, visible } = req.body;
    if (!page || !isKnownPage(page)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing page' });
    }
    if (CUSTOM_PAGE_RE.test(page)) {
      const CustomPage = require('../models/CustomPage');
      const exists = await CustomPage.exists({ _id: page.slice('custom-'.length) });
      if (!exists) return res.status(404).json({ success: false, message: 'Custom page not found' });
    }
    if (!allowedTypesFor(page)?.includes(type)) {
      return res.status(400).json({ success: false, message: `Block type '${type}' is not allowed on page '${page}'` });
    }
    const configError = validateConfig(type, config);
    if (configError) return res.status(400).json({ success: false, message: configError });

    const last = await PageBlock.findOne({ page }).sort({ order: -1 });
    const block = await PageBlock.create({
      page,
      type,
      config,
      visible: visible !== false,
      order: (last?.order ?? -1) + 1,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    await refreshTranslations(block);
    res.status(201).json({ success: true, block });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/page-blocks/:id — config/visible/locked only. Changing a
// block's fundamental `type`/`page` is delete-and-recreate, not an edit, so
// an old config shape can never linger under a type that no longer expects it.
exports.update = async (req, res, next) => {
  try {
    const block = await PageBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });

    let configChanged = false;
    if (req.body.config !== undefined) {
      const configError = validateConfig(block.type, req.body.config);
      if (configError) return res.status(400).json({ success: false, message: configError });
      block.config = req.body.config;
      configChanged = true;
    }
    if (req.body.visible !== undefined) block.visible = !!req.body.visible;
    if (req.body.locked !== undefined) block.locked = !!req.body.locked;
    block.updatedBy = req.user._id;
    await block.save();
    if (configChanged) await refreshTranslations(block);
    res.json({ success: true, block });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/page-blocks/reorder — body { page, orderedIds }. Must be
// registered before PATCH /:id in routes/adminRoutes.js, or Express would
// match "reorder" as an :id. Rejects a partial/mismatched id list rather
// than silently reordering a subset — a partial list here is almost
// certainly a client bug (e.g. a stale local list), not an intentional
// partial reorder.
exports.reorder = async (req, res, next) => {
  try {
    const { page, orderedIds } = req.body;
    if (!page || !isKnownPage(page)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing page' });
    }
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: 'orderedIds must be a non-empty array' });
    }
    const existing = await PageBlock.find({ page }).select('_id');
    const existingIds = existing.map(b => String(b._id)).sort();
    const providedIds = [...orderedIds].map(String).sort();
    if (existingIds.length !== providedIds.length || !existingIds.every((id, i) => id === providedIds[i])) {
      return res.status(400).json({ success: false, message: 'orderedIds must be a complete permutation of this page\'s blocks' });
    }

    await PageBlock.bulkWrite(orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id, page }, update: { order: index, updatedBy: req.user._id } }
    })));
    const blocks = await PageBlock.find({ page }).sort({ order: 1 });
    res.json({ success: true, blocks });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/page-blocks/upload-image (multipart, field "image") —
// standalone upload, not tied to any block id: an Image block's config.url
// needs a hosted URL to exist before it can be saved via create()/update(),
// including the moment it's first being added and has no id yet.
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = useGCS ? (await gcs.uploadFile(req.file)).url : '/uploads/' + req.file.filename;
    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/page-blocks/:id
exports.remove = async (req, res, next) => {
  try {
    const block = await PageBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });
    if (block.locked) return res.status(400).json({ success: false, message: 'This block is locked and cannot be deleted' });
    await block.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
