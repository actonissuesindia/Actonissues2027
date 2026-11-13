// One-off, non-destructive seed for the SEO service/location landing pages
// (see the SEO Foundation Pass plan). Unlike scripts/seed.js, this never
// deletes anything and skips any CustomPage whose slug already exists, so
// re-running it (or running it after an admin has already edited a page in
// the Custom Pages admin tab) is always safe.
//
// Every page is created as Draft — nothing here goes live/public/indexed
// until an Admin reviews it in Admin > Custom Pages and hits Publish.
//
// These are deliberately short, transactional landing pages (what this
// category covers + a way to see/report it), not a rewrite of the existing
// long-form articles (scripts/seedArticles.js already covers "how it works",
// escalation, and a Water Supply how-to, plus a category hub article at
// /articles/report-civic-issue-by-category) — each page links out to the
// matching article instead of duplicating it, so the two don't compete for
// the same search terms.
//
// Usage: node scripts/seedSeoPages.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const CustomPage = require('../models/CustomPage');
const PageBlock = require('../models/PageBlock');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

// Only categories with real reported activity today (see the SEO plan) —
// the other ~10 categories in models/Issue.js's TOPIC_HIERARCHY get a page
// once they have real issues behind them too, same reasoning as location
// pages below.
const SERVICE_PAGES = [
  {
    slug: 'report-roads-infrastructure-issues',
    category: 'Roads & Infrastructure',
    title: 'Report Roads & Infrastructure Issues Online',
    seoTitle: 'Report Roads & Infrastructure Issues',
    seoDescription: 'Report potholes, damaged roads, footpath damage, or missing road signs in your area. See what other residents have already reported, and track it through to resolution.',
    intro: [
      "Roads & Infrastructure is one of the most commonly reported categories on Act On Issues — covering everything from a single pothole to a stretch of road that's been under construction far longer than promised.",
      'Common sub-types include Potholes, Damaged Roads, Road Construction Delay, Footpath Damage, Bridges & Flyovers, Road Signs Missing, Speed Breakers, and Road Encroachments. Picking the closest match when you report gets it in front of the right municipal desk without a back-and-forth.'
    ],
    cards: [
      { title: 'Potholes', text: 'The single most-reported road problem — a precise location and a photo matter more here than anywhere else.' },
      { title: 'Damaged Roads', text: 'Cracked, uneven, or crumbling road surfaces beyond a single pothole.' },
      { title: 'Footpath Damage', text: 'Broken or missing footpaths that make walking unsafe, especially for elderly residents.' },
      { title: 'Road Signs Missing', text: 'Missing or damaged signage that creates a real safety risk, not just an inconvenience.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-water-supply-issues',
    category: 'Water Supply',
    title: 'Report Water Supply Issues Online',
    seoTitle: 'Report Water Supply Issues Online',
    seoDescription: 'No water, low pressure, a leak, or contaminated supply — report a water supply problem, see others reported nearby, and track it through to resolution.',
    intro: [
      'Water Supply problems are some of the most urgent civic issues people report — and some of the easiest for an authority to act on quickly, if the report is specific enough.',
      'Act On Issues splits this category into No Water Supply, Low Water Pressure, Water Leakage, Contaminated Water, Water Tanker Issues, and Water Conservation. A precise address or landmark matters more here than almost anywhere else, since water infrastructure problems are usually hyper-local.'
    ],
    cards: [
      { title: 'No Water Supply', text: 'Complete supply failure to a home, street, or colony.' },
      { title: 'Low Water Pressure', text: 'Supply that arrives but isn’t usable — often a sign of a wider distribution problem.' },
      { title: 'Water Leakage', text: 'Visible leaks from pipelines or connections, often wasting supply for an entire area.' },
      { title: 'Contaminated Water', text: 'Discoloured, smelly, or unsafe water — a public health issue, not just an inconvenience.' }
    ],
    articleSlug: 'how-to-report-water-supply-issue-online',
    articleLabel: 'Read the full water supply reporting guide'
  },
  {
    slug: 'report-street-lighting-issues',
    category: 'Street Lighting',
    title: 'Report Street Lighting Issues Online',
    seoTitle: 'Report Street Lighting Issues',
    seoDescription: 'A dark street, a dim light, or a damaged pole — report a street lighting problem in your area and help get it fixed before it becomes a safety risk.',
    intro: [
      'A street light that’s out for weeks is often dismissed as minor — until it becomes the reason someone gets hurt walking home after dark. Street Lighting reports help make that risk visible before an accident does.',
      'Sub-types include Street Lights Not Working, Dim Lights, Broken Poles, and requests for a New Street Light where one is genuinely needed. A specific pole number or nearby landmark, if you know it, speeds up the fix considerably.'
    ],
    cards: [
      { title: 'Street Lights Not Working', text: 'The most common report — a light that used to work and has stopped.' },
      { title: 'Broken Poles', text: 'Physically damaged or leaning poles — a safety hazard on their own, beyond the light itself.' },
      { title: 'New Street Light Request', text: 'A stretch of road or footpath with no lighting at all.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-drainage-sewage-issues',
    category: 'Drainage & Sewage',
    title: 'Report Drainage & Sewage Issues Online',
    seoTitle: 'Report Drainage & Sewage Issues',
    seoDescription: 'Blocked drains, sewage overflow, or waterlogging on your street — report a drainage or sewage issue and track it through to resolution.',
    intro: [
      'Drainage & Sewage problems tend to get worse the longer they’re ignored — a blocked drain that seems minor in dry weather can flood an entire street in the next heavy rain.',
      'This category covers Drain Blockage, Sewage Overflow, Water Logging, Open Drains, and Storm Water Drain Issues. Reporting before the monsoon season, not just during it, is one of the most useful things a resident can do.'
    ],
    cards: [
      { title: 'Drain Blockage', text: 'Clogged drains that back up or stop flowing entirely.' },
      { title: 'Sewage Overflow', text: 'Sewage visibly overflowing onto a street or public area — a public health hazard.' },
      { title: 'Water Logging', text: 'Standing water that doesn’t drain after rain, often a sign of a blocked or undersized drain.' },
      { title: 'Open Drains', text: 'Uncovered drains that are a safety risk, especially for children.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-garbage-sanitation-issues',
    category: 'Garbage & Sanitation',
    title: 'Report Garbage & Sanitation Issues Online',
    seoTitle: 'Report Garbage & Sanitation Issues',
    seoDescription: 'Garbage collection delays, overflowing dustbins, or illegal dumping — report a sanitation issue in your area and help keep your neighbourhood clean.',
    intro: [
      'Garbage & Sanitation is one of the categories where consistent reporting genuinely changes collection patterns over time — a municipality that sees repeated reports from the same street tends to adjust its route.',
      'Sub-types include Garbage Collection Delay, Overflowing Dustbins, Illegal Dumping, Public Toilet Issues, Open Waste Burning, and general Cleanliness complaints. A photo with a timestamp is especially useful here, since collection schedules are easy to dispute without one.'
    ],
    cards: [
      { title: 'Garbage Collection Delay', text: 'Missed or irregular collection on a street or in a colony.' },
      { title: 'Overflowing Dustbins', text: 'Public bins that have gone uncollected long enough to overflow.' },
      { title: 'Illegal Dumping', text: 'Waste dumped in open plots, roadsides, or water bodies outside designated collection.' },
      { title: 'Open Waste Burning', text: 'Burning of garbage in the open — both a pollution and a health hazard.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-environment-issues',
    category: 'Environment',
    title: 'Report Environment Issues Online',
    seoTitle: 'Report Environment Issues Online',
    seoDescription: 'Air, noise, or water pollution, illegal tree cutting, or plastic waste — report an environmental issue in your area and add your voice to a shared problem.',
    intro: [
      'Environmental problems are often the hardest to get taken seriously as an individual complaint, since the effects build up gradually rather than appearing all at once — which is exactly why a visible, shared public record matters here.',
      'This category covers Air Pollution, Noise Pollution, Water Pollution, Industrial Pollution, Tree Cutting, Plastic Waste, and Illegal Mining. Reports that include a specific source (a factory, a construction site, a particular business) are far more actionable than a general complaint about air or noise quality.'
    ],
    cards: [
      { title: 'Air Pollution', text: 'Smoke, dust, or industrial emissions affecting a specific area.' },
      { title: 'Noise Pollution', text: 'Persistent noise from construction, industry, or commercial activity beyond permitted hours.' },
      { title: 'Tree Cutting', text: 'Unauthorized felling of trees, especially in protected or green-cover areas.' },
      { title: 'Plastic Waste', text: 'Accumulation of plastic waste in public spaces, drains, or water bodies.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-traffic-transportation-issues',
    category: 'Traffic & Transportation',
    title: 'Report Traffic & Transportation Issues Online',
    seoTitle: 'Report Traffic & Transportation Issues',
    seoDescription: 'Traffic congestion, illegal parking, or a broken traffic signal — report a traffic or transportation issue and help get it addressed.',
    intro: [
      'Traffic & Transportation reports are often about a pattern, not a single incident — a signal that’s been down for a week, or a stretch of road where illegal parking causes a daily bottleneck.',
      'Sub-types include Traffic Congestion, Illegal Parking, Traffic Signals, Bus Stop Issues, Public Transport Complaints, and Auto/Taxi Issues. Mentioning the time of day a problem occurs (like peak-hour congestion) helps an authority understand it isn’t a one-off.'
    ],
    cards: [
      { title: 'Traffic Signals', text: 'Signals that are down, malfunctioning, or poorly timed for actual traffic flow.' },
      { title: 'Illegal Parking', text: 'Parking that blocks traffic, footpaths, or emergency access.' },
      { title: 'Bus Stop Issues', text: 'Missing shelters, unsafe stops, or stops not served reliably by scheduled buses.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-animal-issues',
    category: 'Animals',
    title: 'Report Animal-Related Issues Online',
    seoTitle: 'Report Street Dog & Animal Issues',
    seoDescription: 'Street dogs, stray cattle, animal cruelty, or a wildlife concern — report an animal-related civic issue and help get the right department involved.',
    intro: [
      'Animal-related reports usually need a specific department response — an aggressive stray, an injured animal, or unmanaged cattle on a busy road are all safety issues as much as animal welfare ones.',
      'This category covers Street Dogs, Stray Cattle, Animal Cruelty, Dead Animal Removal, and Wildlife Issues. For anything urgent involving an injured or aggressive animal, mention that clearly in the description so it can be prioritized correctly.'
    ],
    cards: [
      { title: 'Street Dogs', text: 'Aggressive or unmanaged stray dog populations in a specific area.' },
      { title: 'Stray Cattle', text: 'Cattle on roads or public spaces creating a traffic or safety hazard.' },
      { title: 'Animal Cruelty', text: 'Mistreatment of animals that needs intervention, not just awareness.' },
      { title: 'Dead Animal Removal', text: 'Carcasses left in public spaces — a health hazard that needs prompt removal.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-housing-land-issues',
    category: 'Housing & Land',
    title: 'Report Housing & Land Issues Online',
    seoTitle: 'Report Housing & Land Issues',
    seoDescription: 'Illegal construction, land encroachment, or a building safety concern — report a housing or land issue and add it to the public record.',
    intro: [
      'Housing & Land issues often involve a slower-moving process than something like a pothole, but a public, dated report still matters — it establishes exactly when a concern was first raised.',
      'Sub-types include Illegal Construction, Land Encroachment, Property Dispute, Housing Affordability, and Building Safety. Photos and, where possible, approximate survey or plot details make these reports significantly more actionable.'
    ],
    cards: [
      { title: 'Illegal Construction', text: 'Construction proceeding without proper approval or outside sanctioned limits.' },
      { title: 'Land Encroachment', text: 'Public or private land being occupied or built on without authorization.' },
      { title: 'Building Safety', text: 'Structural concerns in an existing building that pose a real risk to occupants or the public.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-government-services-issues',
    category: 'Government Services',
    title: 'Report Government Services Issues Online',
    seoTitle: 'Report Government Services Issues',
    seoDescription: 'Municipality, Aadhaar, ration card, pension, or certificate delays — report a government services issue and get it on the public record.',
    intro: [
      'Government Services covers the everyday friction of dealing with municipal and administrative offices — delays, unresponsiveness, or a specific public servant not doing their job.',
      'This includes Municipality Issues, Revenue Department, Panchayat Issues, Aadhaar, Ration Card, Voter ID, Pension, Certificates, and Public Servant Complaint. For anything involving a specific document or application, mention the office and approximate date you applied — it helps identify exactly where the delay is happening.'
    ],
    cards: [
      { title: 'Municipality Issues', text: 'General service or responsiveness problems with the local municipal office.' },
      { title: 'Certificates', text: 'Delays or issues obtaining birth, income, caste, or residence certificates.' },
      { title: 'Pension', text: 'Delays or problems with pension disbursement or applications.' },
      { title: 'Public Servant Complaint', text: 'A specific complaint about a government employee’s conduct or service.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-public-places-recreation-issues',
    category: 'Public Places & Recreation',
    title: 'Report Public Places & Recreation Issues Online',
    seoTitle: 'Report Public Parks & Recreation Issues',
    seoDescription: 'Park maintenance, playground safety, or a community hall in disrepair — report a public places or recreation issue in your area.',
    intro: [
      'Public Places & Recreation covers the shared spaces a neighbourhood actually depends on day to day — a park, a playground, a library, or a community hall that’s stopped being maintained.',
      'Sub-types include Parks Maintenance, Playgrounds, Libraries, Community Halls, and Sports Facilities. Playground safety reports in particular (broken equipment, unsafe surfaces) are worth flagging clearly, since children are the primary users.'
    ],
    cards: [
      { title: 'Parks Maintenance', text: 'Overgrown, neglected, or poorly maintained public parks.' },
      { title: 'Playgrounds', text: 'Broken or unsafe play equipment in public playgrounds.' },
      { title: 'Sports Facilities', text: 'Public sports grounds or facilities that have fallen into disrepair.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-electricity-issues',
    category: 'Electricity',
    title: 'Report Electricity Issues Online',
    seoTitle: 'Report Electricity & Power Issues',
    seoDescription: 'Power outages, low voltage, a damaged pole, or exposed wires — report an electricity issue in your area, especially anything that’s a safety risk.',
    intro: [
      'Electricity reports split into two kinds: ongoing inconvenience (outages, low voltage) and genuine safety hazards (exposed wires, damaged poles) — the second kind deserves the most specific, urgent description you can give it.',
      'This category covers Power Outage, Low Voltage, Transformer Fault, Electric Pole Damage, Exposed Wires, and Illegal Connections. For any hazard involving exposed or fallen wires, mention that explicitly — it changes how urgently a report should be treated.'
    ],
    cards: [
      { title: 'Power Outage', text: 'Extended or repeated power cuts affecting a specific area.' },
      { title: 'Exposed Wires', text: 'A genuine safety hazard — exposed or damaged wiring accessible to the public.' },
      { title: 'Transformer Fault', text: 'Malfunctioning transformers causing outages or voltage problems.' },
      { title: 'Electric Pole Damage', text: 'Leaning, damaged, or unstable electric poles.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-law-order-issues',
    category: 'Law & Order',
    title: 'Report Law & Order Issues Online',
    seoTitle: 'Report Law & Order Issues Online',
    seoDescription: 'Public safety concerns, vandalism, or a corruption complaint — report a law and order issue and add it to a public, trackable record.',
    intro: [
      'Law & Order covers civic-level safety and conduct concerns — not emergencies (which should always go to the police directly first), but the kind of ongoing issue that benefits from a public, dated record.',
      'Sub-types include Corruption, Police Complaint, Public Safety, Theft, Vandalism, Cyber Crime, and Drug Abuse. For anything urgent or actively dangerous, contact local emergency services first — this platform is for building a visible, trackable civic record alongside that, not a replacement for it.'
    ],
    cards: [
      { title: 'Public Safety', text: 'General safety hazards or concerns in a public area.' },
      { title: 'Vandalism', text: 'Damage to public property that needs repair and, ideally, prevention.' },
      { title: 'Corruption', text: 'Reports involving misuse of public office or process.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  },
  {
    slug: 'report-public-health-issues',
    category: 'Public Health',
    title: 'Report Public Health Issues Online',
    seoTitle: 'Report Public Health Issues Online',
    seoDescription: 'Government hospital issues, mosquito breeding grounds, or a food safety concern — report a public health issue in your area.',
    intro: [
      'Public Health reports tend to matter most in aggregate — a single mosquito breeding site is a nuisance, but a pattern of reports across a neighbourhood is what actually justifies a fogging drive or drainage fix.',
      'This category covers Government Hospital Issues, Mosquito Breeding, Food Safety, Public Health Hazard, and Medical Camp Request. Reporting a standing-water or breeding site as soon as you notice it — rather than waiting for it to become a larger outbreak risk — is the most useful timing.'
    ],
    cards: [
      { title: 'Mosquito Breeding', text: 'Standing water or unmaintained sites where mosquitoes are breeding.' },
      { title: 'Government Hospital Issues', text: 'Service, availability, or facility problems at a government hospital.' },
      { title: 'Food Safety', text: 'Unsafe food handling or sale practices affecting public health.' }
    ],
    articleSlug: 'report-civic-issue-by-category',
    articleLabel: 'See the full category guide'
  }
];

// Only Nellore has real reported activity today (16 approved issues, all in
// Nellore, per the SEO plan's DB check) — more cities get a page here the
// same way, once they show real activity, not before.
const LOCATION_PAGES = [
  {
    slug: 'civic-issues-nellore',
    title: 'Civic Issues in Nellore — Report & Track',
    seoTitle: 'Report Civic Issues in Nellore',
    seoDescription: 'Report potholes, water supply problems, garbage collection delays, and other civic issues in Nellore. See what’s already been reported and track it to resolution.',
    intro: [
      'Nellore is where Act On Issues has its most active reporting community today — residents have already used the platform to report problems across roads, water supply, electricity, drainage, sanitation, and more.',
      'Every report follows the same public process: it’s reviewed, published to the public feed, and can gather support from other Nellore residents who’ve noticed the same problem — which is what determines when it gets escalated to the concerned local authority.'
    ],
    cards: [
      { title: 'Roads & Infrastructure', text: 'Potholes, damaged roads, and footpath issues reported across Nellore.' },
      { title: 'Water Supply', text: 'Supply outages, pressure problems, and leaks reported by Nellore residents.' },
      { title: 'Electricity', text: 'Power outages, transformer faults, and safety hazards reported locally.' },
      { title: 'Garbage & Sanitation', text: 'Collection delays and sanitation concerns reported around the city.' }
    ],
    articleSlug: 'how-act-on-issues-works',
    articleLabel: 'See how the whole process works'
  }
];

function buildBlocks(pageId, entry, ctaHref) {
  const blocks = [];
  let order = 0;

  blocks.push({
    page: `custom-${pageId}`,
    type: 'heading',
    order: order++,
    config: { text: entry.title, level: 'h1' }
  });

  blocks.push({
    page: `custom-${pageId}`,
    type: 'richtext',
    order: order++,
    config: { paragraphs: entry.intro }
  });

  blocks.push({
    page: `custom-${pageId}`,
    type: 'cardgrid',
    order: order++,
    config: {
      heading: 'Common issues in this category',
      colClass: 'col-6 col-md-3',
      items: entry.cards
    }
  });

  blocks.push({
    page: `custom-${pageId}`,
    type: 'button',
    order: order++,
    config: { text: 'See these issues on the feed', href: ctaHref }
  });

  if (entry.articleSlug) {
    blocks.push({
      page: `custom-${pageId}`,
      type: 'button',
      order: order++,
      config: { text: entry.articleLabel, href: `/articles/${entry.articleSlug}` }
    });
  }

  return blocks;
}

async function seedOne(entry, ctaHref, admin) {
  const existing = await CustomPage.findOne({ slug: entry.slug });
  if (existing) {
    console.log(`Skipping "${entry.title}" — a page with slug "${entry.slug}" already exists.`);
    return;
  }

  const page = await CustomPage.create({
    title: entry.title,
    slug: entry.slug,
    status: 'Draft',
    seoTitle: entry.seoTitle,
    seoDescription: entry.seoDescription,
    createdBy: admin._id
  });

  const blocks = buildBlocks(page._id, entry, ctaHref).map(b => ({ ...b, createdBy: admin._id }));
  await PageBlock.insertMany(blocks);

  console.log(`Created Draft page "${entry.title}" at /p/${entry.slug} (${blocks.length} blocks)`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const admin = await User.findOne({ role: 'Admin' });
  if (!admin) {
    console.error('No Admin user found — cannot set createdBy. Run scripts/seedAdmin.js first.');
    process.exit(1);
  }

  for (const entry of SERVICE_PAGES) {
    await seedOne(entry, `/feed?category=${encodeURIComponent(entry.category)}`, admin);
  }

  for (const entry of LOCATION_PAGES) {
    await seedOne(entry, '/feed?location=Nellore', admin);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
