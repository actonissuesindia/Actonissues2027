// One-off, non-destructive seed for the "Legal Advice" hub + its six topic
// pages. Same pattern as scripts/seedSeoPages.js — never deletes anything,
// skips any CustomPage whose slug already exists (safe to re-run), and
// creates everything as Draft so nothing goes live until an Admin reviews
// and publishes it in Admin > Custom Pages.
//
// Content is general, India-wide guidance written for a citizen with no
// legal background — not a substitute for professional advice, and every
// page ends with the same disclaimer paragraph saying so explicitly.
// Procedures vary by state; treat this as a starting point, not a final
// authority, and have it reviewed before relying on it for anything
// consequential.
//
// Usage: node scripts/seedLegalHelpPages.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const CustomPage = require('../models/CustomPage');
const PageBlock = require('../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const DISCLAIMER = 'This page provides general information about the process and does not constitute legal advice. Procedures vary by state — consult a local lawyer or the relevant authority for guidance specific to your situation.';

const TOPICS = [
  {
    slug: 'legal-help-criminal-cases',
    title: 'Where to File a Criminal Case',
    seoTitle: 'How to File a Criminal Case in India',
    seoDescription: 'How to file an FIR or a private criminal complaint in India — which police station to approach, what a Zero FIR is, and what to do if the police refuse to register your complaint.',
    intro: [
      'A criminal case usually begins with an FIR (First Information Report) filed at the police station that has jurisdiction over where the offence happened. For serious, cognizable offences (ones the police can investigate and arrest for without a court order — theft, assault, and similar), you can walk into any police station and give your statement; if it happened outside that station\'s jurisdiction, they are required to register a "Zero FIR" and transfer it to the right station, rather than turning you away.',
      'You are entitled to a free copy of the FIR once it is registered. If a police station refuses to register a cognizable offence, the next steps are: approach the Superintendent of Police (or equivalent) in writing, or file a private criminal complaint directly with the local Magistrate\'s court under the applicable criminal procedure law — a Magistrate can direct the police to investigate or take the complaint on record directly.',
      'For a non-cognizable offence (a less serious matter, like most disputes not involving violence or major loss), the police will typically ask you to get a Magistrate\'s order before they investigate, rather than acting on the complaint directly.',
      'Cyber crimes (online fraud, harassment, hacking) can also be reported through the national cybercrime portal in addition to a local police station, which is often faster for anything involving a financial transaction.',
      DISCLAIMER
    ]
  },
  {
    slug: 'legal-help-civil-cases',
    title: 'Where to File a Civil Case',
    seoTitle: 'How to File a Civil Case in India',
    seoDescription: 'Which court handles a civil dispute in India based on the value involved, and what filing a civil suit actually involves.',
    intro: [
      'A civil case (a dispute over money, property, contracts, or similar — not a criminal offence) is filed as a "suit" in a civil court, and which specific court depends mainly on the monetary value of the claim, decided by each state\'s own pecuniary-jurisdiction rules. Smaller-value disputes usually start at a Junior Civil Judge\'s court; larger ones go to a Senior Civil Judge or directly to the District Court.',
      'Certain kinds of disputes — for instance small money-recovery claims in some cities — can go through a Small Causes Court instead, which is designed to move faster than a regular civil suit.',
      'Filing a civil suit involves preparing a plaint (the written statement of your claim), paying court fees (calculated as a percentage of the claim value, which varies by state), and having it registered with the court registry. While it is legally possible to file and argue a civil suit yourself, most people engage an advocate given how procedurally detailed civil litigation is — cross-examination, evidence rules, and multiple hearing stages are all involved.',
      'Before filing, it is worth checking whether your dispute is better suited to a specialized forum instead of a regular civil court — for example, a consumer dispute belongs in a Consumer Disputes Redressal Commission, not a civil court, and usually resolves faster.',
      DISCLAIMER
    ]
  },
  {
    slug: 'legal-help-registration',
    title: 'Property Registration',
    seoTitle: 'How Property Registration Works in India',
    seoDescription: 'How property registration works at the Sub-Registrar\'s office in India — documents needed, stamp duty, and why an unregistered sale is legally risky.',
    intro: [
      'Registering a property transaction (a sale, gift, or certain other transfers) happens at the Sub-Registrar\'s office that covers the area where the property is located, under the Registration Act, 1908. Registration is what makes the transaction legally recognized and part of the public record — an unregistered sale of immovable property above a certain value is not legally valid, regardless of any private agreement between the parties.',
      'The typical documents needed are: the sale deed (or other transfer document) itself, proof of identity of both parties (Aadhaar, PAN), passport-size photos, and proof of the property\'s prior ownership/title. Both the buyer and seller (or their authorized representatives) generally need to be physically present at the Sub-Registrar\'s office at the time of registration, along with witnesses.',
      'Stamp duty (a state tax on the transaction, calculated as a percentage of the property\'s value) has to be paid before or at the time of registration — the exact rate varies significantly by state, and some states offer a reduced rate for property registered in a woman\'s name.',
      'It is always worth verifying the property\'s title and checking for existing encumbrances (loans, disputes, or other claims registered against it) before completing a purchase — most states now offer this encumbrance-certificate check online through their own land-records portal.',
      DISCLAIMER
    ]
  },
  {
    slug: 'legal-help-rti',
    title: 'Filing a Right to Information (RTI) Request',
    seoTitle: 'How to File an RTI Request in India',
    seoDescription: 'How to file a Right to Information (RTI) request under the RTI Act 2005 — fee, format, response timeline, and the appeal process if you don\'t get a reply.',
    intro: [
      'The Right to Information Act, 2005 lets any citizen ask a government body (a "public authority") for information it holds, by submitting a written application to that body\'s Public Information Officer (PIO). The application has to be addressed to the correct authority — a Central government department if the information is federal, or the matching state department if it\'s a state/local matter (like a municipal or panchayat record).',
      'A standard application fee of ₹10 applies (waived for applicants below the poverty line, on submitting the relevant certificate), plus your name and postal address are required on the application itself, so the response can actually be delivered to you. There is no prescribed format — a plain letter clearly stating what information you want is enough, though many public authorities also provide an online portal or a specific application form.',
      'The PIO is legally required to respond within 30 days (this drops to 48 hours for information concerning someone\'s life or liberty). If no response arrives, or the response is unsatisfactory, you can file a first appeal with that department\'s own Appellate Authority within 30 days of the deadline passing, and if that also doesn\'t resolve it, a second appeal to the State or Central Information Commission (whichever applies) follows.',
      'If you would rather have this handled on your behalf — drafting the application correctly, addressing it to the right authority, and following up through the appeal process if needed — you can ask Act On Issues to file an RTI request for you.',
      DISCLAIMER
    ],
    ctaHref: '/rti/new',
    ctaLabel: 'File an RTI Request Through Act On Issues'
  },
  {
    slug: 'legal-help-land-disputes',
    title: 'Civil Land Disputes',
    seoTitle: 'How to Resolve a Civil Land Dispute in India',
    seoDescription: 'The difference between a revenue-record land dispute (Tehsildar/RDO) and a civil-court title dispute in India, and where each one gets resolved.',
    intro: [
      'Land disputes in India generally split into two different tracks, and picking the right one matters — approaching the wrong forum can waste months. A dispute over revenue records — correcting a pattadar passbook, updating mutation entries after inheritance or sale, or resolving a boundary discrepancy in the village records — is handled by revenue authorities: the Village Revenue Officer, Tehsildar, or Revenue Divisional Officer (RDO), depending on the state\'s administrative structure and how serious the dispute is.',
      'A dispute over who actually owns the land, or the validity of a sale/gift/will affecting it, is a title dispute, and that has to go to a civil court, not a revenue office — revenue authorities can update records, but they cannot decide legal ownership when it is genuinely contested. This is one of the areas where getting a lawyer involved early is particularly worthwhile, since a wrongly filed case can be dismissed for being in the wrong forum entirely.',
      'Encroachment on your land by another private party is usually pursued as a civil suit for possession/injunction; encroachment on government or public land is typically reported to the local revenue or municipal authority instead, since you would not personally be the affected title-holder in that case.',
      'Before filing anything, it is worth getting a certified copy of the relevant land records (available through most states\' online land-records portals) — this often clarifies which track the dispute actually belongs on.',
      DISCLAIMER
    ]
  },
  {
    slug: 'legal-help-mortgage-sale',
    title: 'Mortgage and Sale Disputes',
    seoTitle: 'Mortgage and Property Sale Disputes in India',
    seoDescription: 'The basics of mortgage and property sale law in India under the Transfer of Property Act, and what SARFAESI means if a bank is recovering a defaulted loan.',
    intro: [
      'A sale of immovable property is governed by the Transfer of Property Act, 1882, and (as covered on the Registration page) has to be registered to be legally valid above a certain value. Disputes here typically involve an incomplete or disputed sale (money paid but the sale deed never executed or registered), a seller who did not actually have clear title to sell, or a buyer who defaulted on agreed payment terms.',
      'A mortgage is different from a sale — it is property pledged as security for a loan, not a transfer of ownership. India recognizes several types (simple mortgage, English mortgage, equitable mortgage by deposit of title deeds, among others), each with different legal consequences if the borrower defaults, and each generally needs to be registered too, depending on the type and value.',
      'If a bank or financial institution is trying to recover a loan secured against your property, the process usually falls under the SARFAESI Act, 2002, which allows a lender to take possession of and sell secured property without going to court first, subject to a notice period and your right to raise objections. If you believe the bank has proceeded incorrectly or the notice is invalid, the matter is heard by a Debt Recovery Tribunal (DRT), not a regular civil court.',
      'A dispute over an agreement to sell (a preliminary contract before the actual sale deed) is usually pursued as a civil suit for specific performance (compelling the sale to go through) or for a refund with damages — which route makes sense depends heavily on the specific facts, so this is worth a lawyer\'s input before deciding how to proceed.',
      DISCLAIMER
    ]
  }
];

const HUB_INTRO = [
  'This section covers practical, general guidance on common legal questions citizens run into — where to file a case, how property registration works, how to file a Right to Information request, and more.',
  DISCLAIMER
];

function buildTopicBlocks(pageId, entry) {
  const blocks = [];
  let order = 0;
  blocks.push({ page: `custom-${pageId}`, type: 'heading', order: order++, config: { text: entry.title, level: 'h1' } });
  blocks.push({ page: `custom-${pageId}`, type: 'richtext', order: order++, config: { paragraphs: entry.intro } });
  if (entry.ctaHref) {
    blocks.push({ page: `custom-${pageId}`, type: 'button', order: order++, config: { text: entry.ctaLabel, href: entry.ctaHref } });
  }
  // Every topic page gets its own direct path to a lawyer, not just the
  // hub — a citizen reading about, say, land disputes shouldn't have to
  // navigate back up a level first to actually reach one.
  blocks.push({ page: `custom-${pageId}`, type: 'button', order: order++, config: { text: 'Find a Lawyer', href: '/find-a-lawyer' } });
  blocks.push({ page: `custom-${pageId}`, type: 'button', order: order++, config: { text: 'Back to Legal Advice', href: '/p/legal-help' } });
  return blocks;
}

function buildHubBlocks(pageId) {
  const blocks = [];
  let order = 0;
  blocks.push({ page: `custom-${pageId}`, type: 'heading', order: order++, config: { text: 'Legal Advice', level: 'h1' } });
  blocks.push({ page: `custom-${pageId}`, type: 'richtext', order: order++, config: { paragraphs: HUB_INTRO } });
  // CardGridBlock's items don't support a link (see src/components/
  // pageBuilder/blockRenderers/CardGridBlock.jsx — title/text only, purely
  // visual) — so the actual per-topic navigation is a set of `button`
  // blocks below the descriptive grid, not the grid itself.
  blocks.push({
    page: `custom-${pageId}`,
    type: 'cardgrid',
    order: order++,
    config: {
      heading: 'What this covers',
      colClass: 'col-6 col-md-4',
      items: TOPICS.map(t => ({ title: t.title, text: t.seoDescription }))
    }
  });
  blocks.push({ page: `custom-${pageId}`, type: 'heading', order: order++, config: { text: 'Browse by topic', level: 'h2' } });
  for (const t of TOPICS) {
    blocks.push({ page: `custom-${pageId}`, type: 'button', order: order++, config: { text: t.title, href: `/p/${t.slug}` } });
  }
  blocks.push({ page: `custom-${pageId}`, type: 'button', order: order++, config: { text: 'Find a Lawyer', href: '/find-a-lawyer' } });
  blocks.push({ page: `custom-${pageId}`, type: 'button', order: order++, config: { text: 'Request Legal Advice', href: '/rti/new' } });
  return blocks;
}

async function seedPage(slug, title, seoTitle, seoDescription, buildBlocks, admin) {
  const existing = await CustomPage.findOne({ slug });
  if (existing) {
    console.log(`Skipping "${title}" — a page with slug "${slug}" already exists.`);
    return;
  }
  const page = await CustomPage.create({ title, slug, status: 'Draft', seoTitle, seoDescription, createdBy: admin._id });
  const blocks = buildBlocks(page._id).map(b => ({ ...b, createdBy: admin._id }));
  await PageBlock.insertMany(blocks);
  console.log(`Created Draft page "${title}" at /p/${slug} (${blocks.length} blocks)`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const admin = await User.findOne({ role: 'Admin' });
  if (!admin) {
    console.error('No Admin user found — cannot set createdBy. Run scripts/seedAdmin.js first.');
    process.exit(1);
  }

  await seedPage('legal-help', 'Legal Advice', 'Legal Advice — Act On Issues', 'General guidance on filing criminal and civil cases, property registration, RTI requests, land disputes, and mortgage/sale issues in India.', buildHubBlocks, admin);

  for (const entry of TOPICS) {
    await seedPage(entry.slug, entry.title, entry.seoTitle, entry.seoDescription, (pageId) => buildTopicBlocks(pageId, entry), admin);
  }

  await mongoose.disconnect();
  console.log('Done. All pages created as Draft — review and publish each one in Admin > Custom Pages, and toggle "Show in top navigation" on for the hub page.');
}

run().catch(err => { console.error(err); process.exit(1); });
