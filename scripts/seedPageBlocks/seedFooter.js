// One-time, idempotent seed — reproduces Footer.jsx's 3 link columns as
// PageBlock 'link' documents. The Legal column's 3 rows are seeded
// `locked: true` — a UI guardrail (hides the delete/hide controls in Page
// Builder) since removing links to /terms, /privacy, /legal has compliance
// implications; Super Admin can still edit their text/target, just not
// delete them from this panel.
//
// Usage: node scripts/seedPageBlocks/seedFooter.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const REGIONS = {
  'footer-platform': {
    locked: false,
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Issues', href: '/feed' },
      { label: 'Trending', href: '/feed?filter=hot' },
      { label: 'Raise an Issue', href: '/feed' }
    ]
  },
  'footer-account': {
    locked: false,
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Get started', href: '/register' },
      { label: 'My Issues', href: '/my-issues' }
    ]
  },
  'footer-legal': {
    locked: true,
    links: [
      { label: 'Terms of Use', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Legal Disclaimer', href: '/legal' }
    ]
  }
};

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  for (const [page, { locked, links }] of Object.entries(REGIONS)) {
    const existingCount = await PageBlock.countDocuments({ page });
    if (existingCount > 0) {
      console.log(`Skipped ${page} — already has ${existingCount} block(s).`);
      continue;
    }
    for (let i = 0; i < links.length; i++) {
      await PageBlock.create({ page, type: 'link', config: links[i], order: i, visible: true, locked });
    }
    console.log(`Seeded ${page} — ${links.length} block(s)${locked ? ' (locked)' : ''}.`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
