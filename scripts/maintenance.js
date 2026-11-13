// The same one-off data fixes the Admin panel offers, from a terminal.
//
// Both call services/maintenanceService.js, so there is one implementation and
// no chance of the two drifting apart. If you have access to the Control
// Panel, the Maintenance tab there is easier and needs no connection string.
//
// Usage (PowerShell on Windows — see docs/DEPLOYMENT.md "Running a migration
// script on Windows"):
//   cd D:\Act-On-Issues-new-version
//   $env:MONGO_URI = "<connection string>"
//   node scripts/maintenance.js                     # list the jobs
//   node scripts/maintenance.js <job-id>            # show what it would change
//   node scripts/maintenance.js <job-id> --apply    # change it
require('dotenv').config();
const mongoose = require('mongoose');
const maintenance = require('../services/maintenanceService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';
const jobId = process.argv[2];
const APPLY = process.argv.includes('--apply');

function describeTarget(uri) {
  try {
    const { protocol, hostname, pathname } = new URL(uri);
    return `${protocol}//${hostname}${pathname}`;
  } catch {
    return '(unreadable connection string)';
  }
}

function printRows(rows = []) {
  for (const row of rows) {
    const what = row.who || row.label || row.field || row.key || row.menu || '';
    const change = [row.from, row.to].filter(Boolean).join(' -> ');
    const note = row.blocked ? `   BLOCKED: ${row.blocked}` : '';
    console.log(`  ${what}${change ? `: ${change}` : ''}${note}`);
  }
}

async function run() {
  console.log(`Target: ${describeTarget(MONGO_URI)}`);

  if (!jobId) {
    console.log('\nAvailable jobs:\n');
    for (const job of maintenance.list()) {
      console.log(`  ${job.id}${job.danger ? '  (deletes data)' : ''}`);
      console.log(`      ${job.name}`);
    }
    console.log('\nRun one with:  node scripts/maintenance.js <job-id>');
    console.log('It reports what it would change; add --apply to actually change it.');
    return;
  }

  await mongoose.connect(MONGO_URI);

  const preview = await maintenance.preview(jobId);
  if (!preview) {
    console.error(`No job called "${jobId}". Run without arguments to list them.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${preview.name}`);
  console.log(`  ${preview.summary}`);
  printRows(preview.rows);

  if (!APPLY) {
    console.log('\nNothing was changed. Add --apply to make these changes.');
    return;
  }

  const result = await maintenance.apply(jobId);
  console.log(`\nDone: ${result.summary}`);
  printRows(result.done);
  if (result.failed?.length) {
    console.log('\nCould not be changed:');
    for (const row of result.failed) console.log(`  ${row.who}: ${row.reason}`);
  }
}

if (require.main === module) {
  run()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
