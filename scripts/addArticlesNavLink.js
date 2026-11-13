// One-off, non-destructive fix: the Articles/Guides section had no link
// anywhere in the actual site navigation — TopNav and Footer's "Platform"
// column are both Page Builder-driven (models/PageBlock.js, page:
// 'topnav-links' / 'footer-platform'), and this app's live database already
// has real seeded link blocks for both regions, so editing the JSX fallback
// constants (DEFAULT_NAV_LINKS in TopNav.jsx, Footer.jsx's <FooterColumn>
// fallback) would have had zero effect on what visitors actually see.
// Skips a region if an /articles link already exists in it, so re-running
// this (or running it again after someone's rearranged the nav in Page
// Builder) is always safe.
// Usage: node scripts/addArticlesNavLink.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

async function addLink(page, label) {
  const existing = await PageBlock.findOne({ page, 'config.href': '/articles' });
  if (existing) {
    console.log(`Skipping "${page}" — an /articles link already exists there.`);
    return;
  }
  const last = await PageBlock.findOne({ page }).sort({ order: -1 });
  const order = last ? last.order + 1 : 0;
  await PageBlock.create({
    page,
    type: 'link',
    order,
    visible: true,
    locked: false,
    config: { label, href: '/articles' }
  });
  console.log(`Added "${label}" -> /articles to "${page}" at order ${order}.`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');
  await addLink('topnav-links', 'Related Topics');
  await addLink('footer-platform', 'Related Topics');
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
