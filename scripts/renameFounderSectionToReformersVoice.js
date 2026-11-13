// Retitles the personal message section on the About page from "From the
// Founder" to "Reformers Voice". Same class of change as
// renameLegalHelpLabel.js: the heading lives in a PageBlock in the database
// (seeded once by seedPageBlocks/seedFounder.js, which skips a region that
// already exists), so changing the seed file alone only affects a fresh
// install and leaves every live site reading the old wording.
//
// Only the section's own title is touched — the message body, the signature
// line and the photo are left exactly as they are. Both are editable
// afterwards from Page Builder if the wording should differ.
//
// Only rewrites a heading still carrying the old text, so re-running it
// changes nothing and it can't overwrite wording edited by hand since.
//
// Usage (PowerShell on Windows — three lines; see docs/DEPLOYMENT.md
// "Running a migration script on Windows"):
//   cd D:\Act-On-Issues-new-version
//   $env:MONGO_URI = "<connection string>"
//   node scripts/renameFounderSectionToReformersVoice.js
// Usage (Mac/Linux): MONGO_URI="<connection string>" node scripts/renameFounderSectionToReformersVoice.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const OLD_EYEBROW = 'From the Founder';
const NEW_EYEBROW = 'Reformers Voice';
const OLD_HEADING = 'A message from our founder.';
const NEW_HEADING = 'A message to fellow reformers.';

// Which database this is about to change, password stripped — MONGO_URI falls
// back to localhost, so forgetting to set it edits the local development
// database and reports the same success as the real thing.
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

  const eyebrow = await PageBlock.updateMany(
    { page: 'founder-message-body', type: 'heading', 'config.eyebrow': OLD_EYEBROW },
    { $set: { 'config.eyebrow': NEW_EYEBROW } }
  );
  console.log(`Eyebrow "${OLD_EYEBROW}" -> "${NEW_EYEBROW}": ${eyebrow.modifiedCount} updated.`);

  const heading = await PageBlock.updateMany(
    { page: 'founder-message-body', type: 'heading', 'config.text': OLD_HEADING },
    { $set: { 'config.text': NEW_HEADING } }
  );
  console.log(`Heading "${OLD_HEADING}" -> "${NEW_HEADING}": ${heading.modifiedCount} updated.`);

  if (eyebrow.modifiedCount === 0 && heading.modifiedCount === 0) {
    const existing = await PageBlock.findOne({ page: 'founder-message-body', type: 'heading' }).lean();
    console.log(existing
      ? `Nothing to change — the section currently reads "${existing.config.eyebrow}" / "${existing.config.text}".`
      : 'Nothing to change — this site has no founder-message heading block, so the About page is using the wording built into the code.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
