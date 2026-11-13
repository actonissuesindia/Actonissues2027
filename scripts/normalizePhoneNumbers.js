// One-off migration: rewrites any stored phone number that's missing a
// country code (e.g. "7842456778") into E.164 format ("+917842456778").
// Needed because phone-based login (password login by phone, and Firebase
// Phone OTP) compares against the exact stored value — a bare local number
// silently never matches, even though the account is real. Going forward,
// models/User.js normalizes on every save automatically; this script only
// fixes accounts that predate that change. Safe to run more than once —
// already-normalized numbers (starting with "+") are skipped.
// Usage (PowerShell on Windows — two separate lines; the Mac/Linux form of
// putting the setting in front of the command is a CommandNotFoundException
// here, see docs/DEPLOYMENT.md "Running a migration script on Windows"):
//   $env:MONGO_URI = "<connection string>"
//   node scripts/normalizePhoneNumbers.js
// Usage (Mac/Linux): MONGO_URI="<connection string>" node scripts/normalizePhoneNumbers.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { normalizePhone } = require('../utils/normalizePhone');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Set MONGO_URI to the target database connection string.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const users = await User.find({ phone: { $exists: true, $ne: null, $not: /^\+/ } });
  console.log(`Found ${users.length} account(s) with a non-normalized phone number.`);

  let fixed = 0;
  const problems = [];

  for (const user of users) {
    const before = user.phone;
    const after = normalizePhone(before);
    if (after === before) {
      console.log(`  SKIPPED (couldn't confidently normalize) ${user.name}: "${before}"`);
      continue;
    }
    user.phone = after;
    // One account that can't be saved must not abort the run. Two real
    // reasons this happens, and both leave every account after it in the list
    // unfixed — still unable to log in by phone — if the error is allowed to
    // escape: a second account already holds the normalized number (unique
    // index), or the record predates a field that has since become required.
    try {
      await user.save();
      fixed += 1;
      console.log(`  ${user.name}: "${before}" -> "${after}"`);
    } catch (err) {
      const reason = err.code === 11000
        ? `another account already uses "${after}" — these two records are the same person and need merging by hand`
        : err.message;
      problems.push({ id: String(user._id), name: user.name, before, after, reason });
      console.log(`  FAILED ${user.name} ("${before}" -> "${after}"): ${reason}`);
    }
  }

  console.log(`\nDone. ${fixed} fixed, ${problems.length} could not be changed.`);
  if (problems.length) {
    console.log('\nAccounts still needing attention:');
    for (const p of problems) console.log(`  ${p.id}  ${p.name}  "${p.before}"  —  ${p.reason}`);
  }
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
