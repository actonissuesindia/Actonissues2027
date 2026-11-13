// One-off cleanup for the Founder's Message page merge (see About.jsx) —
// removes the now-dead "Founder"/"Founder's Message" nav and footer link
// PageBlock documents. Editing seedTopNav.js/seedFooter.js alone only
// changes what a *fresh, never-seeded* install would get; it doesn't touch
// links an admin already has live in the database, same class of issue as
// the earlier stale "Legal Help" content fix (see renameLegalHelpLabel.js).
//
// Matches on the label as well as the address. The original version looked
// only for href '/founders-message', so a link an admin had created or edited
// by hand — pointing at /about, or at a custom page — survived it and stayed
// in the menu. It also prints what it is about to remove, since deleting rows
// nobody can see afterwards is not something to do silently.
//
// Usage (PowerShell on Windows — three lines; see docs/DEPLOYMENT.md
// "Running a migration script on Windows"):
//   cd D:\Act-On-Issues-new-version
//   $env:MONGO_URI = "<connection string>"
//   node scripts/removeFounderNavLinks.js
// Usage (Mac/Linux): MONGO_URI="<connection string>" node scripts/removeFounderNavLinks.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const MENUS = ['topnav-links', 'footer-platform', 'footer-account', 'footer-legal'];

// Which database this is about to change, with the password stripped out —
// MONGO_URI falls back to localhost, so forgetting to set it edits the local
// development database and reports the same success as the real thing.
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

  const criteria = {
    type: 'link',
    page: { $in: MENUS },
    $or: [
      { 'config.href': '/founders-message' },
      { 'config.label': /founder/i }
    ]
  };

  const doomed = await PageBlock.find(criteria).lean();
  if (doomed.length === 0) {
    console.log('Nothing to remove — no Founder link in any menu.');
  } else {
    for (const block of doomed) {
      console.log(`  removing "${block.config.label}" (${block.config.href}) from ${block.page}`);
    }
    const result = await PageBlock.deleteMany(criteria);
    console.log(`Removed ${result.deletedCount} link(s).`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
