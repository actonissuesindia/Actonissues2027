// One-time, idempotent seed — reproduces TopNav.jsx's desktop nav-pill row
// (Issues/Trending/Top Voices/Games/About/Founder's Message) as PageBlock
// 'link' documents. Deliberately scoped to ONLY that desktop row — the
// mobile hamburger panel and the mobile profile-dropdown's folded links stay
// on their own separate hardcoded JSX (different markup/icons/groupings,
// and a previous mobile-nav fix that can't be visually re-verified here), so
// editing this region in Page Builder currently only affects the desktop view.
//
// Usage: node scripts/seedPageBlocks/seedTopNav.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const LINKS = [
  { label: 'Issues', href: '/feed' },
  { label: 'Trending', href: '/feed?filter=hot' },
  { label: 'Top Voices', href: '/#top-voices' },
  { label: 'Games', href: '/games', requiresAuth: true },
  { label: 'About', href: '/about' }
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const existingCount = await PageBlock.countDocuments({ page: 'topnav-links' });
  if (existingCount > 0) {
    console.log(`Skipped topnav-links — already has ${existingCount} block(s).`);
  } else {
    for (let i = 0; i < LINKS.length; i++) {
      await PageBlock.create({ page: 'topnav-links', type: 'link', config: LINKS[i], order: i, visible: true });
    }
    console.log(`Seeded topnav-links — ${LINKS.length} block(s).`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
