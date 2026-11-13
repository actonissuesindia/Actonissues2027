// Creates the initial Admin and Authority accounts on a database that has
// none yet. Unlike scripts/seed.js, this never deletes existing data — safe
// to run against a live production database with real users already on it
// (it just skips any account whose email already exists).
// Usage (PowerShell on Windows — two separate lines; the Mac/Linux form of
// putting the setting in front of the command is a CommandNotFoundException
// here, see docs/DEPLOYMENT.md "Running a migration script on Windows"):
//   $env:MONGO_URI = "<connection string>"
//   node scripts/seedAdmin.js
// Usage (Mac/Linux): MONGO_URI="<connection string>" node scripts/seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Set MONGO_URI to the target database connection string.');
  process.exit(1);
}

const accounts = [
  { name: 'Admin', email: 'actonissuesindia@gmail.com', password: process.env.ADMIN_PW, role: 'Admin' }
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  for (const acc of accounts) {
    const existing = await User.findOne({ email: acc.email });
    if (existing) {
      console.log(`Skipped ${acc.email} — already exists.`);
      continue;
    }
    await User.create(acc);
    console.log(`Created ${acc.role}: ${acc.email}`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
