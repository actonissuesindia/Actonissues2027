// One-off migration: marks every account that already existed before the
// welcome tour feature shipped as having already seen it, so it doesn't
// suddenly pop up for people who already know the site. New accounts get
// hasSeenWelcomeTour: false by default (see models/User.js) and see the
// tour once, the normal way. Safe to run against a live database — only
// touches accounts where the field is missing, never deletes anything.
// Usage (PowerShell on Windows — two separate lines; the Mac/Linux form of
// putting the setting in front of the command is a CommandNotFoundException
// here, see docs/DEPLOYMENT.md "Running a migration script on Windows"):
//   $env:MONGO_URI = "<connection string>"
//   node scripts/backfillWelcomeTourSeen.js
// Usage (Mac/Linux): MONGO_URI="<connection string>" node scripts/backfillWelcomeTourSeen.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Set MONGO_URI to the target database connection string.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const res = await User.updateMany(
    { hasSeenWelcomeTour: { $exists: false } },
    { $set: { hasSeenWelcomeTour: true } }
  );
  console.log(`Marked ${res.modifiedCount} existing account(s) as having already seen the welcome tour.`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
