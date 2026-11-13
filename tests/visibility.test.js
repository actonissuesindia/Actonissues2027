const request = require('supertest');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const { app, signIn, createUser, createIssue } = require('./helpers');

// A report awaiting review is not public. That was enforced on the report and
// nowhere else, so its comment thread and its moderation timeline were served
// to anyone who asked — no sign-in, no relationship to the post. These tests
// pin the rule to every route it has to hold on, because the leak was never in
// the rule itself but in the places that forgot to ask.
describe('Who can see what', () => {
  let author;
  let stranger;
  let staff;
  let authorAgent;
  let strangerAgent;
  let staffAgent;

  beforeEach(async () => {
    author = await createUser({ name: 'Report Author' });
    stranger = await createUser({ name: 'Unrelated Citizen' });
    staff = await createUser({ name: 'Moderator', role: 'Admin' });
    authorAgent = await signIn(author);
    strangerAgent = await signIn(stranger);
    staffAgent = await signIn(staff);
  });

  async function reportAwaitingReview() {
    const issue = await createIssue({ reporter: author, moderationStatus: 'Pending' });
    await Comment.create({ issue: issue._id, user: author._id, text: 'a private remark' });
    await Activity.create({ issue: issue._id, user: staff._id, action: 'moderation', details: 'Post rejected' });
    return issue;
  }

  describe('a report still awaiting review', () => {
    it('hides its comments from anyone not signed in', async () => {
      const issue = await reportAwaitingReview();
      const res = await request(app).get(`/api/comments/${issue._id}`).expect(404);
      expect(JSON.stringify(res.body)).not.toContain('a private remark');
    });

    it('hides its comments from an unrelated signed-in person', async () => {
      const issue = await reportAwaitingReview();
      const res = await strangerAgent.get(`/api/comments/${issue._id}`).expect(404);
      expect(JSON.stringify(res.body)).not.toContain('a private remark');
    });

    it('shows its comments to the person who filed it', async () => {
      const issue = await reportAwaitingReview();
      const res = await authorAgent.get(`/api/comments/${issue._id}`).expect(200);
      expect(res.body.comments[0].text).toBe('a private remark');
    });

    it('shows its comments to staff', async () => {
      const issue = await reportAwaitingReview();
      await staffAgent.get(`/api/comments/${issue._id}`).expect(200);
    });

    it('hides its moderation timeline — including who reviewed it — from the public', async () => {
      const issue = await reportAwaitingReview();
      const res = await request(app).get(`/api/activity/${issue._id}`).expect(404);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('Post rejected');
      expect(body).not.toContain('Moderator');
    });

    it('hides its moderation timeline from an unrelated signed-in person', async () => {
      const issue = await reportAwaitingReview();
      await strangerAgent.get(`/api/activity/${issue._id}`).expect(404);
    });

    it('shows its moderation timeline to staff', async () => {
      const issue = await reportAwaitingReview();
      const res = await staffAgent.get(`/api/activity/${issue._id}`).expect(200);
      expect(res.body.activities[0].details).toBe('Post rejected');
    });

    it('hides its escalation thread from an unrelated signed-in person', async () => {
      const issue = await reportAwaitingReview();
      await strangerAgent.get(`/api/issues/${issue._id}/escalations`).expect(404);
    });

    it('hides the report itself from an unrelated signed-in person', async () => {
      const issue = await reportAwaitingReview();
      await strangerAgent.get(`/api/issues/${issue._id}`).expect(404);
    });

    it('keeps it out of the public feed', async () => {
      await reportAwaitingReview();
      const res = await request(app).get('/api/issues').expect(200);
      expect(res.body.issues).toHaveLength(0);
    });
  });

  describe('an approved report', () => {
    it('lets anyone read its comments, signed in or not', async () => {
      const issue = await createIssue({ reporter: author, moderationStatus: 'Approved' });
      await Comment.create({ issue: issue._id, user: author._id, text: 'a public remark' });

      const res = await request(app).get(`/api/comments/${issue._id}`).expect(200);
      expect(res.body.comments[0].text).toBe('a public remark');
    });

    it('appears in the public feed', async () => {
      await createIssue({ reporter: author, moderationStatus: 'Approved' });
      const res = await request(app).get('/api/issues').expect(200);
      expect(res.body.issues).toHaveLength(1);
    });
  });

  describe('a report that does not exist', () => {
    it('answers the same way as one you are not allowed to see', async () => {
      // Same 404 either way — anything else confirms to a stranger that a
      // given report exists.
      const missing = '6a670645b88217c763322d6f';
      await strangerAgent.get(`/api/comments/${missing}`).expect(404);
      await strangerAgent.get(`/api/activity/${missing}`).expect(404);
    });

    it('does not fall over on a malformed id', async () => {
      await request(app).get('/api/comments/not-a-real-id').expect(404);
      await request(app).get('/api/activity/not-a-real-id').expect(404);
    });
  });
});
