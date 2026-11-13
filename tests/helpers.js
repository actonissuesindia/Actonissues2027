const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Issue = require('../models/Issue');

// Shared scaffolding for the test files. Everything here builds real records
// through the real models, so a test fails when the application's own rules
// change — which is the point.

const DEFAULT_PASSWORD = 'TestPass1!';

// A signed-in browser. supertest's agent keeps the session cookie between
// requests, so this logs in the way a person does and every later call on the
// returned agent carries that session — no faking req.user, which would test
// the handlers while skipping the middleware that decides who you are.
async function signIn(user, password = DEFAULT_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ identifier: user.email, password });
  if (res.status !== 200) {
    throw new Error(`Test sign-in failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

async function createUser({ name = 'Test Citizen', role = 'Citizen', email, phone, password = DEFAULT_PASSWORD } = {}) {
  // Unique per call so tests never collide on the account's unique fields.
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  return User.create({
    name,
    role,
    email: email || `user${stamp}@example.com`,
    phone,
    password
  });
}

async function createIssue({ reporter, moderationStatus = 'Approved', title = 'A test report', description = 'Something needs fixing on this street.', location = { address: '1 Test Road, Nellore', city: 'Nellore' }, status } = {}) {
  return Issue.create({
    title,
    description,
    category: 'Roads & Infrastructure',
    topic: 'Roads & Infrastructure',
    subTopic: 'Potholes',
    location,
    reporter: reporter._id,
    moderationStatus,
    ...(status ? { status } : {})
  });
}

// The fields a valid submission carries, as the browser sends them.
function issueForm({ description = 'A pothole has opened up outside the school gate.', address = '1 Test Road, Nellore', city = 'Nellore' } = {}) {
  return {
    title: description.slice(0, 80),
    description,
    topic: 'Roads & Infrastructure',
    subTopic: 'Potholes',
    priority: 'Medium',
    location: JSON.stringify({ address, city }),
    timezone: 'Asia/Kolkata'
  };
}

// Posts an issue as multipart, the way PostIssueModal does, optionally with
// files. `files` is a list of { name, buffer }.
function postIssue(agent, fields = issueForm(), files = []) {
  const req = agent.post('/api/issues');
  for (const [key, value] of Object.entries(fields)) req.field(key, String(value));
  for (const file of files) req.attach('attachments', file.buffer, file.name);
  return req;
}

// A real, decodable 1x1 PNG — small enough to keep tests fast, valid enough
// that image handling doesn't reject it for the wrong reason.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

module.exports = { app, signIn, createUser, createIssue, issueForm, postIssue, PNG_1x1, DEFAULT_PASSWORD };
