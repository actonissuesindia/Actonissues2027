// Runs before every test file.
//
// Two jobs: point the app at a throwaway database *before* it is imported
// (server.js reads MONGO_URI as it loads), and leave that database empty
// between tests so each one starts from a known state and no test can pass
// or fail because of what another one left behind.
require('dotenv').config();

// beforeAll/beforeEach/afterAll (and describe/it/expect/vi in the test files)
// are provided as globals — see `globals: true` in vitest.config.mjs. Vitest
// itself is an ES module and can't be require()d from CommonJS like this.
const mongoose = require('mongoose');

// Never the development database, and never production. Defaults to a local
// database named for what it is; override with TEST_MONGO_URI if your MongoDB
// lives somewhere else.
const TEST_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/actonissue_test';

// A guard, not a formality: this file deletes every document in every
// collection between tests. Pointed at the wrong database that is a disaster,
// and the wrong database is one careless copied line away.
const databaseName = TEST_URI.split('/').pop().split('?')[0];
if (!/test/i.test(databaseName)) {
  throw new Error(
    `Refusing to run tests against "${databaseName}" — the test database wipes itself between tests, ` +
    'so its name must contain "test". Set TEST_MONGO_URI to a database named accordingly.'
  );
}

process.env.MONGO_URI = TEST_URI;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-only-secret';

// The app logs a lot of expected noise during these tests on purpose — a
// notification that can't send, an image that can't be fetched. Those paths
// are exactly what several tests exercise, so their output is silenced to
// keep the results readable. Set TEST_VERBOSE=1 to see everything.
if (!process.env.TEST_VERBOSE) {
  console.log = () => {};
  console.error = () => {};
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_URI);
  }
  await mongoose.connection.asPromise();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map(c => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
