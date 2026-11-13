// One-time, idempotent seed — reproduces About.jsx's current hardcoded
// content as PageBlock documents so the Super Admin's first visit to Page
// Builder shows exactly what's live today. Safe to re-run: each region is
// only seeded if it has zero blocks already.
//
// Not migrated in this pass: the "Focus areas, right now" chips (live
// category-count data) and the "As on Today" stats cards (live stats) stay
// hardcoded in About.jsx — not block-manageable. The "Neutrality & Legal"
// region is also intentionally NOT migrated: its text has inline links to
// /legal, /terms, /privacy, and the richtext block type is plain-text-only
// by design (no HTML, to rule out stored-XSS) — migrating it would silently
// drop working legal links, so it stays fully hardcoded instead.
//
// Usage: node scripts/seedPageBlocks/seedAbout.js
require('dotenv').config();
const mongoose = require('mongoose');
const PageBlock = require('../../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const REGIONS = {
  'about-hero': [
    { type: 'heading', config: { eyebrow: 'About Act On Issues', text: 'Turning public problems into public action.', level: 'h1' } },
    { type: 'richtext', config: { paragraphs: [
      "Across India's cities, towns, and villages, citizens face the same frustrations every day — leaking pipelines, damaged roads, faulty streetlights, unsafe electrical wiring, land encroachment, civic neglect, and gaps in public services. Most of these problems are visible to everyone. They persist not because solutions don't exist, but because they go unreported, unheard, and unresolved — with no clear channel to raise them, no way to follow up, and no accountability for action.",
      "We're a social startup built to change that — a bridge between citizens and the institutions responsible for addressing their concerns, so that no issue quietly disappears."
    ] } },
    { type: 'button', config: { text: 'Browse Issues', href: '/feed', style: 'gradient' } },
    { type: 'button', config: { text: 'Join the Movement', href: '/register', style: 'outline' } }
  ],
  'about-what-we-do': [
    { type: 'heading', config: { eyebrow: 'What We Do', text: 'A citizen-driven platform, built for real outcomes', level: 'h2' } },
    { type: 'richtext', config: { paragraphs: [
      'We provide a channel where anyone can report a public or civic issue, make it visible, and ensure it reaches the right authority — transparently and responsibly.'
    ] } },
    { type: 'richtext', config: { paragraphs: [
      '✓ Report public and civic issues you encounter',
      '✓ Share the location, photographs, and a clear description',
      '✓ Track the status of a reported issue over time',
      '✓ Encourage timely, responsible action from the concerned department'
    ] } }
  ],
  'about-how-it-works': [
    { type: 'heading', config: { eyebrow: 'How It Works', text: 'Simple, transparent, built for real outcomes', level: 'h2' } },
    { type: 'cardgrid', config: { colClass: 'col-md-4 col-lg', items: [
      { icon: 'bi-pencil-square', title: 'Report an issue', text: 'Submit a public issue with a description, photos, and location — takes under a minute.' },
      { icon: 'bi-search', title: 'Review & organize', text: "Each report is checked for clarity and relevance before it's published for everyone to see." },
      { icon: 'bi-signpost-split-fill', title: 'Reach the right people', text: "It's visible to Authority accounts for the relevant department — no guesswork about who should see it." },
      { icon: 'bi-graph-up-arrow', title: 'Track progress', text: 'Status updates — Open, In Progress, Resolved — are shown publicly as the issue moves forward.' },
      { icon: 'bi-check-circle-fill', title: 'Resolution & closure', text: "Once addressed, it's marked resolved and stays visible — nothing quietly disappears." }
    ] } },
    { type: 'richtext', config: { paragraphs: [
      "A report left unreviewed doesn't get lost — if no one actions it within the admin-configured review window, it's automatically published so it stays visible either way."
    ] } }
  ],
  'about-values': [
    { type: 'heading', config: { eyebrow: 'Our Values', text: 'What guides how we build this', level: 'h2' } },
    { type: 'cardgrid', config: { colClass: 'col-6 col-md-4 col-lg-2', items: [
      { icon: 'bi-people-fill', title: 'Citizens First', text: 'Public welfare above all else.' },
      { icon: 'bi-shield-check', title: 'Integrity', text: 'Honest reporting and ethical action.' },
      { icon: 'bi-eye-fill', title: 'Transparency', text: 'Open visibility of issues and outcomes.' },
      { icon: 'bi-lightning-charge-fill', title: 'Youth Leadership', text: 'Energy, responsibility, and fresh thinking.' },
      { icon: 'bi-hand-thumbs-up-fill', title: 'Collaboration', text: 'Stronger solutions through collective effort.' },
      { icon: 'bi-bullseye', title: 'Action-Oriented', text: 'Awareness paired with measurable results.' }
    ] } }
  ],
  'about-mission-vision': [
    { type: 'cardgrid', config: { colClass: 'col-md-6', items: [
      { icon: 'bi-bullseye', title: 'Our Mission', text: 'To empower citizens to identify, report, and resolve everyday public and civic issues through a transparent, technology-driven platform that promotes accountability, community participation, and real-world action. Empowering citizens to turn everyday public problems into real solutions.' },
      { icon: 'bi-eye', title: 'Our Vision', text: 'A society where no public issue is ignored, citizens are active participants in governance, and everyday civic problems are addressed efficiently, ethically, and collaboratively — creating safer, smarter, and more livable communities for all. A society where public issues are seen, heard, and solved.' }
    ] } }
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
