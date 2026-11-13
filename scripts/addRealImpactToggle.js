// One-off, non-destructive fix: the "Real impact" public stats section on
// Home was added after the 'home-layout' Page Builder region already existed
// (scripts/seedPageBlocks/seedHome.js), so it was never registered as a
// toggle there — Super Admin had no way to hide/reorder it like every other
// live-data section. seedHome.js itself won't add it to an already-seeded
// site (it skips any region that already has blocks), so this backfills it
// specifically: inserts a 'realImpact' toggle at order 0 (matching where the
// section actually renders — right after the hero, before Latest Issues) and
// bumps every existing 'home-layout' block's order up by one to make room.
// Skips outright if a 'realImpact' toggle already exists, so it's always
// safe to re-run.
// Usage: node scripts/addRealImpactToggle.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const existing = await PageBlock.findOne({ page: 'home-layout', 'config.key': 'realImpact' });
  if (existing) {
    console.log('Skipping — a "realImpact" toggle already exists on home-layout.');
    await mongoose.disconnect();
    return;
  }

  await PageBlock.updateMany({ page: 'home-layout' }, { $inc: { order: 1 } });
  await PageBlock.create({
    page: 'home-layout',
    type: 'toggle',
    order: 0,
    visible: true,
    locked: true,
    config: { key: 'realImpact', label: 'Real impact (public stats)' }
  });
  console.log('Added "Real impact" toggle to home-layout at order 0.');

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
