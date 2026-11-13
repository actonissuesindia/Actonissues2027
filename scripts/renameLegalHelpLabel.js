// One-off, non-destructive fix for leftover "Legal Help" text that
// predates the "Legal Advice" rename — the nav-link PageBlock was
// admin-added (not from any seed script) and the CustomPage/heading block
// were created back when seedLegalHelpPages.js still said "Legal Help";
// that script only creates its page once and skips if the slug already
// exists, so its later text change to "Legal Advice" never touched the
// already-seeded DB records. Only updates documents whose text is still
// exactly "Legal Help" — safe to re-run.
//
// Usage: node scripts/renameLegalHelpLabel.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../models/PageBlock');
const CustomPage = require('../models/CustomPage');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const navLinks = await PageBlock.updateMany(
    { type: 'link', 'config.label': 'Legal Help' },
    { $set: { 'config.label': 'Legal Advice' } }
  );
  console.log(`Nav/footer links renamed: ${navLinks.modifiedCount}`);

  const page = await CustomPage.findOneAndUpdate(
    { slug: 'legal-help', title: 'Legal Help' },
    { $set: { title: 'Legal Advice' } },
    { new: true }
  );
  console.log(page ? `Page title renamed (id ${page._id}).` : 'Page title already up to date (or not found).');

  if (page) {
    const heading = await PageBlock.updateMany(
      { page: `custom-${page._id}`, type: 'heading', 'config.text': 'Legal Help' },
      { $set: { 'config.text': 'Legal Advice' } }
    );
    console.log(`Page heading blocks renamed: ${heading.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
