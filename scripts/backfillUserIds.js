// One-off migration: assigns a User ID ("<name-slug>@aoi") to every
// existing account created before this field existed. Safe to run against
// a live database — only touches accounts with no userId yet, and never
// deletes anything. New accounts already get one automatically via the
// User model's pre-save hook; this just backfills the ones that predate it.
// Usage (PowerShell on Windows — two separate lines; the Mac/Linux form of
// putting the setting in front of the command is a CommandNotFoundException
// here, see docs/DEPLOYMENT.md "Running a migration script on Windows"):
//   $env:MONGO_URI = "<connection string>"
//   node scripts/backfillUserIds.js
// Usage (Mac/Linux): MONGO_URI="<connection string>" node scripts/backfillUserIds.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateUniqueUserId } = require('../utils/generateUserId');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Set MONGO_URI to the target database connection string.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const users = await User.find({ $or: [{ userId: { $exists: false } }, { userId: null }] });
  console.log(`Found ${users.length} account(s) without a User ID.`);

  for (const user of users) {
    user.userId = await generateUniqueUserId(user.name, (candidate) => User.exists({ userId: candidate }));
    await user.save();
    console.log(`  ${user.name} (${user.email || user.phone}) -> ${user.userId}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
