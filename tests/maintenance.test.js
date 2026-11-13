const request = require('supertest');
const User = require('../models/User');
const PageBlock = require('../models/PageBlock');
const AuditLog = require('../models/AuditLog');
const maintenance = require('../services/maintenanceService');
const { app, signIn, createUser } = require('./helpers');

// These jobs change stored data across every account from a browser button,
// which is convenient and therefore worth being careful about. Two things the
// tests hold: a preview never writes, and nothing destructive runs without
// being confirmed by name on the server — not merely in the browser.
describe('Maintenance jobs', () => {
  describe('previews', () => {
    it('report what would change without changing it', async () => {
      const user = await createUser({ name: 'Legacy Phone' });
      await User.collection.updateOne({ _id: user._id }, { $set: { phone: '9876500011' } });

      const report = await maintenance.preview('phone-normalize');

      expect(report.rows).toHaveLength(1);
      expect(report.rows[0].from).toBe('9876500011');
      expect(report.rows[0].to).toBe('+919876500011');
      // Untouched — that is what makes it a preview.
      expect((await User.findById(user._id).lean()).phone).toBe('9876500011');
    });

    it('name the accounts a fix cannot be applied to, and why', async () => {
      const legacy = await createUser({ name: 'Old Record' });
      await User.collection.updateOne({ _id: legacy._id }, { $set: { phone: '9876500011' } });
      await createUser({ name: 'Newer Record', phone: '+919876500011' });

      const report = await maintenance.preview('phone-normalize');

      // The blocker is the thing worth surfacing: two accounts, one person.
      expect(report.rows[0].blocked).toMatch(/already uses/i);
      expect(report.rows[0].blocked).toContain('Newer Record');
    });
  });

  describe('running them', () => {
    it('repairs what it can and keeps going past what it cannot', async () => {
      const fixable = await createUser({ name: 'Fixable' });
      const blocked = await createUser({ name: 'Blocked' });
      await User.collection.updateOne({ _id: fixable._id }, { $set: { phone: '9876500022' } });
      await User.collection.updateOne({ _id: blocked._id }, { $set: { phone: '9876500011' } });
      await createUser({ name: 'Holds It', phone: '+919876500011' });

      const result = await maintenance.apply('phone-normalize');

      // One account that cannot be saved must not stop the rest — the failure
      // mode the original script had.
      expect(result.done).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect((await User.findById(fixable._id).lean()).phone).toBe('+919876500022');
      expect((await User.findById(blocked._id).lean()).phone).toBe('9876500011');
    });

    it('changes only labels still carrying the old wording', async () => {
      await PageBlock.create({ page: 'feed-toggles', type: 'toggle', order: 0, visible: true, config: { key: 'tagsSidebar', label: 'Tags sidebar (list of categories)' } });
      await PageBlock.create({ page: 'feed-toggles', type: 'toggle', order: 1, visible: true, config: { key: 'search', label: 'Search box' } });

      const before = await maintenance.preview('feed-toggle-labels');
      expect(before.rows).toHaveLength(1);

      await maintenance.apply('feed-toggle-labels');

      const renamed = await PageBlock.findOne({ 'config.key': 'tagsSidebar' }).lean();
      expect(renamed.config.label).toBe('Categories sidebar');
      // Already correct, so left alone.
      const untouched = await PageBlock.findOne({ 'config.key': 'search' }).lean();
      expect(untouched.config.label).toBe('Search box');
    });

    it('is safe to run twice', async () => {
      await PageBlock.create({ page: 'feed-toggles', type: 'toggle', order: 0, visible: true, config: { key: 'tagsSidebar', label: 'Tags sidebar (list of categories)' } });

      await maintenance.apply('feed-toggle-labels');
      const second = await maintenance.apply('feed-toggle-labels');

      expect(second.summary).toMatch(/0 label/);
    });

    it('deletes retired menu links from every menu', async () => {
      await PageBlock.create({ page: 'topnav-links', type: 'link', order: 3, visible: true, config: { label: 'Founder', href: '/founders-message' } });
      await PageBlock.create({ page: 'footer-platform', type: 'link', order: 1, visible: true, config: { label: "Founder's Message", href: '/founders-message' } });
      await PageBlock.create({ page: 'topnav-links', type: 'link', order: 0, visible: true, config: { label: 'Issues', href: '/feed' } });

      const preview = await maintenance.preview('retired-links');
      expect(preview.rows).toHaveLength(2);

      await maintenance.apply('retired-links');

      expect(await PageBlock.countDocuments({ 'config.href': '/founders-message' })).toBe(0);
      // Everything else stays.
      expect(await PageBlock.countDocuments({ 'config.href': '/feed' })).toBe(1);
    });
  });

  describe('who can run them', () => {
    it('are closed to an Admin-tier account, not just to citizens', async () => {
      // Stored 'Authority' is the tier shown as "Admin"; these jobs are for
      // the owner account only.
      const adminTier = await signIn(await createUser({ role: 'Authority' }));
      await adminTier.get('/api/admin/maintenance').expect(403);
      await adminTier.post('/api/admin/maintenance/retired-links/run').expect(403);
    });

    it('are closed to citizens and to anyone signed out', async () => {
      const citizen = await signIn(await createUser());
      await citizen.get('/api/admin/maintenance').expect(403);
      await request(app).get('/api/admin/maintenance').expect(401);
    });

    it('are open to the Super Admin', async () => {
      const owner = await signIn(await createUser({ role: 'Admin' }));
      const res = await owner.get('/api/admin/maintenance').expect(200);
      expect(res.body.jobs.length).toBeGreaterThan(0);
      expect(res.body.jobs.every(j => j.id && j.name && j.why)).toBe(true);
    });
  });

  describe('the guard on destructive jobs', () => {
    it('refuses without the typed confirmation, server-side', async () => {
      const owner = await signIn(await createUser({ role: 'Admin' }));
      await PageBlock.create({ page: 'topnav-links', type: 'link', order: 3, visible: true, config: { label: 'Founder', href: '/founders-message' } });

      // The browser collects the confirmation, but the browser is not where a
      // safeguard belongs — a direct call must be refused too.
      const res = await owner.post('/api/admin/maintenance/retired-links/run').send({}).expect(400);
      expect(res.body.message).toMatch(/confirm/i);
      expect(await PageBlock.countDocuments({ 'config.href': '/founders-message' })).toBe(1);
    });

    it('runs once confirmed, and records who did it', async () => {
      const owner = await createUser({ role: 'Admin' });
      const agent = await signIn(owner);
      await PageBlock.create({ page: 'topnav-links', type: 'link', order: 3, visible: true, config: { label: 'Founder', href: '/founders-message' } });

      await agent.post('/api/admin/maintenance/retired-links/run')
        .send({ confirm: 'retired-links' })
        .expect(200);

      expect(await PageBlock.countDocuments({ 'config.href': '/founders-message' })).toBe(0);
      const entry = await AuditLog.findOne({ action: 'maintenance_run' }).lean();
      expect(String(entry.user)).toBe(String(owner._id));
      expect(entry.details).toMatch(/deleted/i);
    });

    it('does not demand confirmation for a job that only renames', async () => {
      const agent = await signIn(await createUser({ role: 'Admin' }));
      await PageBlock.create({ page: 'feed-toggles', type: 'toggle', order: 0, visible: true, config: { key: 'tagsSidebar', label: 'Tags sidebar (list of categories)' } });

      await agent.post('/api/admin/maintenance/feed-toggle-labels/run').send({}).expect(200);
    });
  });

  it('rejects a job name that does not exist', async () => {
    const agent = await signIn(await createUser({ role: 'Admin' }));
    await agent.get('/api/admin/maintenance/drop-everything/preview').expect(404);
    await agent.post('/api/admin/maintenance/drop-everything/run').expect(404);
  });
});
