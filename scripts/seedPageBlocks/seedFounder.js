// One-time, idempotent seed — reproduces the Founder's Message section on
// About.jsx (src/pages/About/About.jsx, formerly its own standalone
// /founders-message page) as PageBlock documents. The message body's 6
// paragraphs and its "— Founder, Act On Issues" signature are two separate
// richtext blocks so the signature can be edited independently of the body.
// The photo itself (BlobAvatar, GET/POST/DELETE /api/founder-image) is
// untouched — it already has its own staff-editable upload flow and isn't
// part of this feature. No separate Mission & Vision region here — About
// already has its own equivalent section.
//
// Usage: node scripts/seedPageBlocks/seedFounder.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const REGIONS = {
  'founder-message-body': [
    // Retitled from "From the Founder" — an already-seeded site keeps the old
    // wording until scripts/renameFounderSectionToReformersVoice.js is run,
    // since this script skips a region that already exists.
    { type: 'heading', config: { eyebrow: 'Reformers Voice', text: 'A message to fellow reformers.', level: 'h1' } },
    { type: 'richtext', config: { paragraphs: [
      "Every day, we see problems around us that quietly chip away at our quality of life — leaking water pipelines, unsafe electricity poles, poor street lighting, civic neglect, environmental damage, and gaps in education, healthcare, and women's safety. These aren't rare occurrences. For millions of people, they're daily realities.",
      'What troubled me most was never just the presence of these issues — it was how often they were ignored, delayed, or left unresolved simply because there was no awareness, no coordination, and no accountability.',
      'Act On Issues was founded on a simple belief: when citizens are empowered with the right platform and support, real change is possible.',
      "Our goal is to give people a responsible, transparent, and constructive way to raise public issues — and to ensure those issues receive the attention they deserve. We're not here to criticize systems; we're here to strengthen them, by connecting people, data, and action.",
      "I believe today's youth carry both the responsibility and the ability to shape a better future. Through collaboration, integrity, and persistence, we can turn everyday problems into opportunities for meaningful impact.",
      "This is not just a platform. It's a movement for a more aware, accountable, and inclusive society."
    ] } },
    { type: 'richtext', config: { paragraphs: ['— Founder, Act On Issues'] } }
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
