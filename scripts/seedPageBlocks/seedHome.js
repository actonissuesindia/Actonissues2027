// One-time, idempotent seed — reproduces Home.jsx's hardcoded "How it works"
// steps and CTA banner copy as PageBlock documents, plus a 'home-layout'
// region of locked 'toggle' placeholders (order + show/hide only) for every
// live-data section: Real impact, Latest Issues, Trending chips, Hot Topics
// carousel, and Top Voices. Their actual content still comes from live data,
// not editable block config — this just lets Super Admin show/hide/reorder
// the sections themselves, alongside the two fully-editable ones above. NOT
// covered at all: the hero's eyebrow/description/headline (stay on
// SystemSetting keys HERO_EYEBROW_TEXT/HERO_DESCRIPTION_TEXT and the
// HeroQuote model — already Super-Admin editable via their own existing UI)
// and the staff-only "Platform at a glance" stats strip (not shown to
// citizens, so not part of the public page layout).
//
// Usage: node scripts/seedPageBlocks/seedHome.js
// A site seeded before 'realImpact' existed here won't get it from a re-run
// (this skips any region that already has blocks) — see
// scripts/addRealImpactToggle.js for backfilling that one onto an
// already-seeded 'home-layout'.
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const REGIONS = {
  'home-layout': [
    { type: 'toggle', config: { key: 'realImpact', label: 'Real impact (public stats)' }, locked: true },
    { type: 'toggle', config: { key: 'latestIssues', label: 'Latest Issues preview' }, locked: true },
    { type: 'toggle', config: { key: 'trendingChips', label: 'Trending chips (categories)' }, locked: true },
    { type: 'toggle', config: { key: 'hotTopicsCarousel', label: 'Hot Topics carousel' }, locked: true },
    { type: 'toggle', config: { key: 'topVoices', label: 'Top Voices' }, locked: true },
    { type: 'toggle', config: { key: 'howItWorks', label: 'How it Works steps' }, locked: true },
    { type: 'toggle', config: { key: 'ctaBanner', label: 'CTA banner' }, locked: true }
  ],
  'home-how-it-works': [
    { type: 'heading', config: { eyebrow: 'How it works', text: 'Four steps. No phone calls.', level: 'h2' } },
    { type: 'cardgrid', config: { colClass: 'col-md-3', items: [
      { icon: 'bi-geo-alt-fill', title: 'Post it', text: "Snap a photo, drop a pin, write what's wrong. Takes under a minute." },
      { icon: 'bi-heart-fill', title: 'Get upvoted', text: 'Neighbours upvote and comment, pushing it up the priority list.' },
      { icon: 'bi-signpost-split-fill', title: 'Routed automatically', text: 'Visible to the right authorities for your ward — no guesswork.' },
      { icon: 'bi-check-lg', title: 'Resolved, publicly', text: "Status updates in the open, until it's marked fixed for good." }
    ] } }
  ],
  'home-cta-banner': [
    // level 'h1' here (not 'h2') to match the original's fs-1 large sizing —
    // the original used an <h2> tag with an fs-1 class; HeadingBlock ties
    // level directly to both tag and size, so this trades an exact tag match
    // for matching the intended visual size.
    { type: 'heading', config: { text: 'Be heard. Be counted.', level: 'h1' } },
    { type: 'richtext', config: { paragraphs: ['Join citizens turning everyday complaints into public, trackable action.'] } }
  ]
};

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  for (const [page, blocks] of Object.entries(REGIONS)) {
    const existingCount = await PageBlock.countDocuments({ page });
    if (existingCount > 0) {
      console.log(`Skipped ${page} — already has ${existingCount} block(s).`);
      continue;
    }
    for (let i = 0; i < blocks.length; i++) {
      await PageBlock.create({ ...blocks[i], page, order: i, visible: true });
    }
    console.log(`Seeded ${page} — ${blocks.length} block(s).`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
