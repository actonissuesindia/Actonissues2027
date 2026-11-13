// Strips everything but letters/digits so "Chaithanya Ssi" -> "chaithanyassi".
// Falls back to a generic base if a name has no usable characters at all
// (e.g. empty, or entirely emoji/punctuation).
function slugifyForUserId(name) {
  const base = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return base || 'user';
}

// Builds "<slug>@aoi", falling back to "<slug>2@aoi", "<slug>3@aoi", ... on
// a collision. `checkExists(candidate)` is injected rather than importing
// the User model directly, so this stays reusable from the model's own
// pre-save hook (see models/User.js) without a require cycle, and from the
// one-off migration script (scripts/backfillUserIds.js).
async function generateUniqueUserId(name, checkExists) {
  const base = slugifyForUserId(name);
  let candidate = `${base}@aoi`;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await checkExists(candidate)) {
    candidate = `${base}${suffix}@aoi`;
    suffix += 1;
  }
  return candidate;
}

module.exports = { slugifyForUserId, generateUniqueUserId };
