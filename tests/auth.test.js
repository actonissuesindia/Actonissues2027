const request = require('supertest');
const User = require('../models/User');
const firebaseAdmin = require('../services/firebaseAdminService');
const { app, signIn, createUser, DEFAULT_PASSWORD } = require('./helpers');

describe('Signing in with a password', () => {
  it('accepts the right password and starts a session', async () => {
    const user = await createUser({ name: 'Asha Rao' });
    const agent = await signIn(user);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.name).toBe('Asha Rao');
  });

  it('rejects the wrong password without saying which half was wrong', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: user.email, password: 'not-the-password' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects an unknown account with the same wording', async () => {
    // Anything more specific tells a stranger which email addresses exist.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@example.com', password: DEFAULT_PASSWORD })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });

  it('turns away a disabled account', async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { isDisabled: true });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: user.email, password: DEFAULT_PASSWORD })
      .expect(403);

    expect(res.body.message).toMatch(/disabled/i);
  });

  it('leaves no session behind for someone who never signed in', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });
});

// Phone sign-in locked people out of accounts they demonstrably owned: the
// code repaired an old-format phone number as part of signing in, and when
// that repair failed — for reasons having nothing to do with the person at
// the keyboard — it took the whole sign-in down with it, on every attempt.
describe('Signing in with a phone code', () => {
  const E164 = '+919876500011';
  const LEGACY = '9876500011';

  // Firebase sends and checks the SMS itself; the server only ever sees the
  // token it hands back. Standing in for it here keeps the test about our
  // half of the exchange.
  const withVerifiedNumber = (phoneNumber = E164) =>
    vi.spyOn(firebaseAdmin, 'verifyIdToken').mockResolvedValue({ phone_number: phoneNumber });

  afterEach(() => vi.restoreAllMocks());

  // Writes a record the way it existed before phone numbers were normalized,
  // bypassing the model hook that would tidy it up on the way in.
  async function createLegacyPhoneAccount(extra = {}) {
    const user = await createUser({ name: 'Legacy Account' });
    await User.collection.updateOne({ _id: user._id }, { $set: { phone: LEGACY }, ...extra });
    return user;
  }

  it('signs in an account stored in the old format, and tidies it up', async () => {
    withVerifiedNumber();
    const user = await createLegacyPhoneAccount();

    const res = await request(app).post('/api/auth/firebase-phone').send({ idToken: 'stand-in' }).expect(200);

    expect(res.body.user._id).toBe(String(user._id));
    expect((await User.findById(user._id)).phone).toBe(E164);
  });

  it('signs in even when the same number exists on two accounts', async () => {
    withVerifiedNumber();
    const legacy = await createLegacyPhoneAccount();
    const current = await createUser({ name: 'Current Account', phone: E164 });

    const res = await request(app).post('/api/auth/firebase-phone').send({ idToken: 'stand-in' }).expect(200);

    // The normalized record is the real identity, so that is the one signed in.
    expect(res.body.user._id).toBe(String(current._id));
    expect(res.body.user._id).not.toBe(String(legacy._id));
  });

  it('signs in even when the account record itself cannot be saved', async () => {
    withVerifiedNumber();
    // A record old enough to be missing a field that has since become
    // required — its repair can't be written, and that must not matter.
    const user = await createLegacyPhoneAccount({ $unset: { name: '' } });

    const res = await request(app).post('/api/auth/firebase-phone').send({ idToken: 'stand-in' }).expect(200);

    expect(res.body.user._id).toBe(String(user._id));
    // Unwritten, so the stored value is untouched rather than half-changed.
    expect((await User.findById(user._id)).phone).toBe(LEGACY);
  });

  it('refuses a token Firebase does not recognise', async () => {
    vi.spyOn(firebaseAdmin, 'verifyIdToken').mockRejectedValue(new Error('invalid token'));

    const res = await request(app).post('/api/auth/firebase-phone').send({ idToken: 'forged' }).expect(401);
    expect(res.body.message).toMatch(/could not verify/i);
  });

  it('refuses a request with no token at all', async () => {
    await request(app).post('/api/auth/firebase-phone').send({}).expect(400);
  });

  it('does not create an account for an unknown number during sign-in', async () => {
    withVerifiedNumber('+919876500099');
    const before = await User.countDocuments();

    // Login never collects a name, so the server has nothing to create an
    // account from — Register is the only path that makes one.
    await request(app).post('/api/auth/firebase-phone').send({ idToken: 'stand-in' }).expect(400);

    expect(await User.countDocuments()).toBe(before);
  });
});
