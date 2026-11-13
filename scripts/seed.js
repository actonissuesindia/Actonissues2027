// Seed demo data: Admin, Authority, and three Citizen accounts, plus a wide
// spread of sample issues (with photos) across the topic taxonomy.
// Usage: npm run seed
//
// Photos are hotlinked from https://picsum.photos — a free, no-API-key image
// service. They're realistic stock photos but not literally on-topic (no free
// keyword-searchable image API exists anymore — Unsplash Source was retired
// in 2023), so treat them as visual placeholders, not documentary photos.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Issue = require('../models/Issue');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const img = (seed, w = 900, h = 600) => ({
  fileName: `${seed}.jpg`,
  originalName: `${seed}.jpg`,
  url: `https://picsum.photos/seed/${seed}/${w}/${h}`
});

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Seeding...');

  await Promise.all([User.deleteMany({}), Issue.deleteMany({})]);

  await User.create({
    name: 'Admin User', email: 'admin@acton.dev', password: 'admin123', role: 'Admin'
  });
  const authority = await User.create({
    name: 'Ward Authority', email: 'authority@acton.dev', password: 'authority123', role: 'Authority'
  });
  const citizen = await User.create({
    name: 'Jane Citizen', email: 'citizen@acton.dev', password: 'citizen123', role: 'Citizen'
  });
  const citizen2 = await User.create({
    name: 'Rohan Mehta', email: 'rohan@acton.dev', password: 'citizen123', role: 'Citizen'
  });
  const citizen3 = await User.create({
    name: 'Priya Rao', phone: '+919876543210', password: 'citizen123', role: 'Citizen'
  });

  const reporters = [citizen, citizen2, citizen3];
  const pick = (list, i) => list[i % list.length];

  const samples = [
    {
      title: 'Pothole near Main Road', description: 'Large pothole causing traffic near the market junction — two scooters have skidded here this week.',
      topic: 'Roads & Infrastructure', subTopic: 'Potholes', priority: 'High', status: 'Open',
      location: { address: 'Main Road, Ward 4', city: 'Nellore', ward: 'Ward 4' },
      attachments: [img('pothole-1')], featured: true
    },
    {
      title: 'Sewage overflowing onto footpath', description: 'Drainage has been overflowing onto the footpath after every rain for the past three weeks.',
      topic: 'Drainage & Sewage', subTopic: 'Sewage Overflow', priority: 'High', status: 'In Progress',
      location: { address: 'Ward 12 Main Street', city: 'Nellore', ward: 'Ward 12' },
      attachments: [img('drainage-1')], featured: true
    },
    {
      title: 'Streetlights out on park lane', description: 'Two streetlights have been dark for over a week, making the lane unsafe after sunset.',
      topic: 'Street Lighting', subTopic: 'Street Lights Not Working', priority: 'Medium', status: 'Open',
      location: { address: 'Park Lane', city: 'Nellore', ward: 'Ward 6' },
      attachments: [img('streetlight-1')]
    },
    {
      title: 'No water supply for three days', description: 'Entire street has had no water supply for three days now — tankers have not arrived either.',
      topic: 'Water Supply', subTopic: 'No Water Supply', priority: 'High', status: 'Resolved',
      location: { address: 'Sector 7', city: 'Nellore', ward: 'Ward 7' },
      attachments: [img('water-1')]
    },
    {
      title: 'Bins overflowing outside market', description: 'Garbage bins outside the vegetable market have been overflowing for five days straight, attracting stray animals.',
      topic: 'Garbage & Sanitation', subTopic: 'Overflowing Dustbins', priority: 'Medium', status: 'Open',
      location: { address: 'Sector 9 Market', city: 'Nellore', ward: 'Ward 9' },
      attachments: [img('garbage-1'), img('garbage-2')], featured: true
    },
    {
      title: 'Illegal parking blocking bus stop', description: 'Cars parked illegally at the bus stop are forcing commuters onto the road every morning.',
      topic: 'Traffic & Transportation', subTopic: 'Illegal Parking', priority: 'Medium', status: 'Open',
      location: { address: 'Bus Stand Road', city: 'Nellore', ward: 'Ward 3' },
      attachments: [img('parking-1')]
    },
    {
      title: 'Healthy trees cut without permission', description: 'Several full-grown trees near the community park were cut overnight without any visible permit notice.',
      topic: 'Environment', subTopic: 'Tree Cutting', priority: 'Medium', status: 'Open',
      location: { address: 'Community Park', city: 'Nellore', ward: 'Ward 5' },
      attachments: [img('trees-1')]
    },
    {
      title: 'Mosquito breeding in stagnant water', description: 'Construction site next to the school has stagnant water pooling for over two weeks — dengue risk.',
      topic: 'Public Health', subTopic: 'Mosquito Breeding', priority: 'High', status: 'In Progress',
      location: { address: 'Near Govt School', city: 'Nellore', ward: 'Ward 8' },
      attachments: [img('mosquito-1')]
    },
    {
      title: 'Aggressive stray dog pack near school', description: 'A pack of stray dogs has been chasing schoolchildren near the main gate every afternoon.',
      topic: 'Animals', subTopic: 'Street Dogs', priority: 'High', status: 'Open',
      location: { address: 'School Road', city: 'Nellore', ward: 'Ward 2' },
      attachments: [img('dogs-1')], featured: true
    },
    {
      title: 'Illegal construction encroaching on road', description: 'A new structure has extended onto the public road, narrowing it to a single lane.',
      topic: 'Housing & Land', subTopic: 'Illegal Construction', priority: 'Medium', status: 'Open',
      location: { address: 'Temple Street', city: 'Nellore', ward: 'Ward 11' },
      attachments: [img('construction-1')]
    },
    {
      title: 'Community park unmaintained for months', description: 'Play equipment is broken and the grounds are overgrown — the park has had no maintenance visit in months.',
      topic: 'Public Places & Recreation', subTopic: 'Parks Maintenance', priority: 'Low', status: 'Open',
      location: { address: 'Nehru Park', city: 'Nellore', ward: 'Ward 5' },
      attachments: [img('park-1')], moderationStatus: 'Pending'
    },
    {
      title: 'Bus stop shelter vandalized', description: 'The glass panels of the bus shelter were smashed over the weekend; commuters have no cover from rain.',
      topic: 'Law & Order', subTopic: 'Vandalism', priority: 'Low', status: 'Resolved',
      location: { address: 'College Road', city: 'Nellore', ward: 'Ward 3' },
      attachments: [img('vandalism-1')]
    },
    {
      title: 'Municipality office unresponsive on complaint', description: 'Filed a written complaint about road repair three months ago with no follow-up or response.',
      topic: 'Government Services', subTopic: 'Municipality Issues', priority: 'Medium', status: 'In Progress',
      location: { address: 'Municipal Office', city: 'Nellore', ward: 'Ward 1' },
      attachments: [img('municipality-1')]
    },
    {
      title: 'Water leaking from main pipeline', description: 'A burst pipe has been leaking continuously for two days, wasting water and flooding the lane.',
      topic: 'Water Supply', subTopic: 'Water Leakage', priority: 'High', status: 'Resolved',
      location: { address: 'Ward 12 Cross Street', city: 'Nellore', ward: 'Ward 12' },
      attachments: [img('leak-1')]
    },
    {
      title: 'Duplicate pothole report', description: 'Already reported and fixed last month — closing as a duplicate submission of AOI-000001.',
      topic: 'Roads & Infrastructure', subTopic: 'Damaged Roads', priority: 'Low', status: 'Rejected',
      location: { address: 'Main Road, Ward 4', city: 'Nellore', ward: 'Ward 4' },
      attachments: [img('pothole-2')]
    },
    {
      title: 'Frequent power outages every evening', description: 'Power cuts out for 1-2 hours every evening around 7pm, disrupting homework and small businesses.',
      topic: 'Electricity', subTopic: 'Power Outage', priority: 'Medium', status: 'Open',
      location: { address: 'Gandhi Nagar', city: 'Nellore', ward: 'Ward 10' },
      attachments: [img('power-1')], moderationStatus: 'Pending'
    },
    {
      title: 'Check out this investment opportunity', description: 'Promotional spam unrelated to any civic issue — kept as a demo example of a moderation-rejected submission.',
      topic: 'Other', subTopic: 'User Defined Category', customCategory: 'Off Topic Promotional Content', priority: 'Low', status: 'Open',
      location: { address: 'N/A', city: 'Nellore' },
      attachments: [img('spam-1')], moderationStatus: 'Rejected'
    }
  ];

  let pendingCount = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const reporter = pick(reporters, i);
    // Seed data represents an already-running platform, so default to Approved
    // unless a sample explicitly demos the Pending/Rejected moderation queue.
    const moderationStatus = s.moderationStatus || 'Approved';
    const issue = await Issue.create({ ...s, moderationStatus, category: s.topic, reporter: reporter._id });
    if (moderationStatus !== 'Pending') {
      issue.moderatedBy = authority._id;
      issue.moderatedAt = new Date();
    } else {
      pendingCount++;
    }
    issue.supporters = reporters.filter(r => String(r._id) !== String(reporter._id)).map(r => r._id);
    await issue.save();
  }

  console.log(`Seed complete: ${samples.length} issues (${pendingCount} pending review).`);
  console.log('  Admin     -> admin@acton.dev / admin123');
  console.log('  Authority -> authority@acton.dev / authority123');
  console.log('  Citizen   -> citizen@acton.dev / citizen123');
  console.log('  Citizen   -> rohan@acton.dev / citizen123');
  console.log('  Citizen   -> +919876543210 (phone) / citizen123');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
