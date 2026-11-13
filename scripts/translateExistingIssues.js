// One-time (but safe to re-run) backfill: translates every issue that was
// created before issue auto-translation existed — those went through
// Issue.create() directly (or through the controller before this feature
// shipped) so they never got a `translations` field populated, and still
// show up in their original language for every viewer, including
// Admin/Authority reviewing the moderation queue. Re-running this is
// harmless: it just re-translates and overwrites with the same (or
// updated) result.
//
// Requires GOOGLE_TRANSLATE_API_KEY to be set (see docs/DEPLOYMENT.md Step
// 18) — without it, translateIssueFields() silently returns no
// translations for everything, so this script completes without error but
// produces no translations.
// Usage: node scripts/translateExistingIssues.js
require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const { refreshIssueTranslations } = require('../controllers/issueController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

async function run() {
  if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
    console.warn('GOOGLE_TRANSLATE_API_KEY is not set — this will run without producing any translations. See docs/DEPLOYMENT.md Step 18.');
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const issues = await Issue.find().select('issueNumber title description');
  console.log(`Translating ${issues.length} issue(s)...`);
  for (const issue of issues) {
    await refreshIssueTranslations(issue._id, issue.title, issue.description);
    console.log(`  - ${issue.issueNumber || issue._id}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
