// One-time, idempotent seed — creates the 5 fixed toggle rows for the Feed
// page's chrome. Unlike every other seed script here, these are the only
// blocks for 'feed-toggles' that will ever exist: the admin panel's Feed
// sub-panel is toggle-switches-only (no add/delete/reorder), matching the
// plan's decision that Feed is data-driven and can't be a free-form builder.
//
// Usage: node scripts/seedPageBlocks/seedFeedToggles.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const TOGGLES = [
  { key: 'search', label: 'Search box' },
  { key: 'locationFilter', label: 'Location filter' },
  { key: 'tagsSidebar', label: 'Categories sidebar' },
  { key: 'fab', label: 'Floating "Raise an Issue" button' },
  { key: 'scrollTop', label: 'Scroll to top/bottom button' }
];

// Which database this is about to change, with the password stripped out.
// MONGO_URI falls back to localhost above, so forgetting to set it doesn't
// fail — it quietly edits the local development database and reports success,
// which looks identical to having done the real thing.
function describeTarget(uri) {
  try {
    const { protocol, hostname, pathname } = new URL(uri);
    return `${protocol}//${hostname}${pathname}`;
  } catch {
    return '(unreadable connection string)';
  }
}

async function run() {
  console.log(`Target: ${describeTarget(MONGO_URI)}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const existingCount = await PageBlock.countDocuments({ page: 'feed-toggles' });
  if (existingCount > 0) {
    // The label is what the admin panel prints next to each switch, and it
    // lives in the database — so renaming one in the list above would
    // otherwise only ever reach a brand-new deployment. The `key` is the
    // identity (the Feed reads toggles by key, see isToggleOn) and is never
    // touched; only the wording is brought up to date, which is why this is
    // still safe to run as many times as you like.
    let renamed = 0;
    for (const toggle of TOGGLES) {
      const result = await PageBlock.updateOne(
        { page: 'feed-toggles', 'config.key': toggle.key, 'config.label': { $ne: toggle.label } },
        { $set: { 'config.label': toggle.label } }
      );
      if (result.modifiedCount) {
        renamed += 1;
        console.log(`  relabelled "${toggle.key}" -> "${toggle.label}"`);
      }
    }
    console.log(`Skipped creating feed-toggles — already has ${existingCount} block(s). ${renamed} label(s) updated.`);
  } else {
    for (let i = 0; i < TOGGLES.length; i++) {
      await PageBlock.create({ page: 'feed-toggles', type: 'toggle', config: TOGGLES[i], order: i, visible: true });
    }
    console.log(`Seeded feed-toggles — ${TOGGLES.length} block(s).`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
