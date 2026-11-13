// Test-only helper: inserts a known OTP code directly into Mongo so we can
// verify the /otp/verify flow end-to-end without real email delivery.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';
const identifier = process.argv[2];
const code = process.argv[3] || '123456';

async function run() {
  await mongoose.connect(MONGO_URI);
  const codeHash = await bcrypt.hash(code, 10);
  await Otp.create({
    identifier,
    channel: 'email',
    codeHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });
  console.log(`OTP ${code} seeded for ${identifier}`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
