// One-time (but safe to re-run) backfill: translates every Published
// Article and every Page Builder block that was created *before* the
// auto-translation feature existed — those went through Article.create()/
// PageBlock.create() directly (a seed script, or a save from before this
// feature shipped) rather than the controllers below, so they never got a
// `translations` field populated. Re-running this is harmless: it just
// re-translates and overwrites with the same (or updated) result.
//
// Requires GOOGLE_TRANSLATE_API_KEY to be set (see docs/DEPLOYMENT.md Step
// 18) — without it, translateFields() silently returns {} for everything,
// so this script completes without error but produces no translations.
// Usage: node scripts/translateExistingContent.js
require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');
const PageBlock = require('../models/PageBlock');
const { refreshTranslations: refreshArticle } = require('../controllers/articleController');
const { refreshTranslations: refreshBlock } = require('../controllers/pageBlockController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

async function run() {
  if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
    console.warn('GOOGLE_TRANSLATE_API_KEY is not set — this will run without producing any translations. See docs/DEPLOYMENT.md Step 18.');
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const articles = await Article.find({ status: 'Published' });
  console.log(`Translating ${articles.length} published article(s)...`);
  for (const article of articles) {
    await refreshArticle(article);
    console.log(`  - ${article.slug}`);
  }

  const blocks = await PageBlock.find({ type: { $in: ['heading', 'richtext', 'button', 'cardgrid', 'link'] } });
  console.log(`Translating ${blocks.length} page block(s)...`);
  for (const block of blocks) {
    await refreshBlock(block);
    console.log(`  - ${block.page}/${block.type} (${block._id})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
