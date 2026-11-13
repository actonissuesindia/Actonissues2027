// Lowercase, hyphenate, strip anything that isn't a letter/digit/space/hyphen
// — unlike utils/generateUserId.js's slugifyForUserId (which strips ALL
// separators for an opaque login handle), this keeps word boundaries since
// the result is a human-readable URL segment.
function slugify(text) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'article';
}

// Same collision-suffix pattern as generateUniqueUserId (utils/generateUserId.js) —
// appends -2, -3, ... until `checkExists` reports no conflict. `excludeId`
// lets an update skip colliding with the article's own current slug.
async function generateUniqueSlug(Model, text, excludeId) {
  const base = slugify(text);
  let candidate = base;
  let suffix = 2;
  const exists = async (slug) => {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    return !!(await Model.exists(query));
  };
  // eslint-disable-next-line no-await-in-loop
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

module.exports = { slugify, generateUniqueSlug };
