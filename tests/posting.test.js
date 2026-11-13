const Issue = require('../models/Issue');
const notifyService = require('../services/notifyService');
const { signIn, createUser, issueForm, postIssue, PNG_1x1 } = require('./helpers');

// Filing a report is the one thing this site exists to do, and the way it
// used to fail was the worst kind: it told the reporter it had failed while
// filing the report anyway, so they filed it again. Four copies of one report
// (AOI-000203 to AOI-000206) is what that looked like in production.
//
// Every test here asserts on two things together — what the reporter was told,
// and how many reports actually exist. Either alone would have passed while
// the bug was live.
describe('Filing a report', () => {
  let citizen;
  let agent;

  beforeEach(async () => {
    citizen = await createUser();
    agent = await signIn(citizen);
  });

  it('files exactly one report and confirms it', async () => {
    const res = await postIssue(agent).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.issue.title).toBeTruthy();
    expect(await Issue.countDocuments()).toBe(1);
  });

  it('keeps the photos that came with it', async () => {
    const res = await postIssue(agent, issueForm(), [
      { name: 'street.png', buffer: PNG_1x1 },
      { name: 'closer.png', buffer: PNG_1x1 }
    ]).expect(201);

    const saved = await Issue.findById(res.body.issue._id);
    expect(saved.attachments).toHaveLength(2);
    expect(saved.attachments[0].originalName).toBe('street.png');
  });

  describe('when something is wrong with the submission', () => {
    // The rule the reporter asked for in as many words: a failure must not
    // leave a report behind. Each case checks the message explains itself
    // rather than saying "something went wrong".
    it('refuses a file type it cannot accept, and files nothing', async () => {
      const res = await postIssue(agent, issueForm(), [
        { name: 'IMG_2231.HEIC', buffer: PNG_1x1 }
      ]).expect(400);

      expect(res.body.message).toContain('IMG_2231.HEIC');
      expect(res.body.message).toMatch(/JPG, PNG, MP4 or MOV/);
      expect(await Issue.countDocuments()).toBe(0);
    });

    it('refuses a submission with no location, and files nothing', async () => {
      const { location, ...withoutLocation } = issueForm();
      const res = await postIssue(agent, withoutLocation).expect(400);

      expect(res.body.message).toMatch(/Location is required/i);
      expect(await Issue.countDocuments()).toBe(0);
    });

    it('refuses a submission with no description, and files nothing', async () => {
      const fields = issueForm();
      const res = await postIssue(agent, { ...fields, title: '', description: '' }).expect(400);

      expect(res.body.message).toMatch(/description/i);
      expect(await Issue.countDocuments()).toBe(0);
    });

    it('turns anyone not signed in away', async () => {
      const request = require('supertest');
      const { app } = require('./helpers');
      await postIssue(request(app), issueForm()).expect(401);

      expect(await Issue.countDocuments()).toBe(0);
    });
  });

  describe('pressing the button more than once', () => {
    it('returns the report already filed instead of filing a second', async () => {
      const fields = issueForm({ description: 'The streetlight outside 12 Main Road has been dark for a week.' });

      const first = await postIssue(agent, fields).expect(201);
      const second = await postIssue(agent, fields).expect(200);
      const third = await postIssue(agent, fields).expect(200);

      expect(second.body.alreadyFiled).toBe(true);
      expect(third.body.issue._id).toBe(first.body.issue._id);
      expect(await Issue.countDocuments()).toBe(1);
    });

    it('still files separate reports for the same wording at different places', async () => {
      const wording = 'The streetlight is not working.';

      await postIssue(agent, issueForm({ description: wording, address: '4th Cross, Nellore' })).expect(201);
      await postIssue(agent, issueForm({ description: wording, address: '9th Cross, Nellore' })).expect(201);

      expect(await Issue.countDocuments()).toBe(2);
    });

    it('does not merge two people reporting the same thing', async () => {
      const neighbour = await createUser({ name: 'Neighbour' });
      const neighbourAgent = await signIn(neighbour);
      const fields = issueForm({ description: 'The drain on our street is overflowing again.' });

      await postIssue(agent, fields).expect(201);
      await postIssue(neighbourAgent, fields).expect(201);

      expect(await Issue.countDocuments()).toBe(2);
    });
  });

  // The second, independent cause of the duplicates: the confirmation email
  // and bell notification ran before the reporter was told anything, and were
  // allowed to fail the whole request.
  it('still confirms the report when the notification system is down', async () => {
    const outage = vi.spyOn(notifyService, 'notify').mockRejectedValue(new Error('notification service unavailable'));

    try {
      const res = await postIssue(agent).expect(201);
      expect(res.body.success).toBe(true);
      expect(await Issue.countDocuments()).toBe(1);
    } finally {
      outage.mockRestore();
    }
  });
});
