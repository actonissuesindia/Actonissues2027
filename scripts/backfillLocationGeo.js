// One-off migration: populate location.geo (GeoJSON Point, 2dsphere-indexed)
// on existing issues from their already-stored location.lat/location.lng, so
// the radius search (issueController.list's lat/lng/radiusKm params) works
// on issues created before that field existed. New issues get this set
// automatically by Issue.js's pre('save') hook — this script only needs to
// run once, against data that predates it.
// Usage: node scripts/backfillLocationGeo.js
require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Backfilling location.geo...');

  const issues = await Issue.find({
    'location.lat': { $ne: null },
    'location.lng': { $ne: null },
    'location.geo': { $exists: false }
  });

  console.log(`Found ${issues.length} issue(s) needing location.geo.`);
  for (const issue of issues) {
    issue.location.geo = { type: 'Point', coordinates: [issue.location.lng, issue.location.lat] };
    await issue.save();
  }

  console.log('Done.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
