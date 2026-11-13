const User = require('../models/User');
const PageBlock = require('../models/PageBlock');
const { normalizePhone } = require('../utils/normalizePhone');

// The one-off data fixes, as jobs that can be run from a browser.
//
// These all existed as scripts in scripts/, and in practice that meant they
// did not get run: each one needs a terminal, the right folder, the right
// shell syntax and a production connection string, and every step is a place
// to give up. Four of them sat undone for days while the code that depended
// on them was live — the Founder link stayed in the header, phone sign-in
// stayed broken for the accounts it affected.
//
// So the logic lives here, and both the scripts and the admin screen call it.
// Same code, same result, whichever way it is triggered — the alternative is
// two implementations that drift, which is its own bug.
//
// Every job has two halves. `preview` reads and reports and must never write.
// `apply` does the work. Nothing runs without a person seeing the preview
// first, because these operate on live data and several are not reversible.

const JOBS = [];
const register = (job) => { JOBS.push(job); return job; };

// ---------------------------------------------------------------------------
register({
  id: 'phone-normalize',
  name: 'Repair phone numbers missing their country code',
  why: 'Phone sign-in compares against the full +91 form. An account stored as "9876500011" can never match, so its owner is locked out of phone login even though the account is real.',
  danger: false,
  async preview() {
    const users = await User.find({ phone: { $exists: true, $ne: null, $not: /^\+/ } })
      .select('name email phone')
      .lean();

    const rows = [];
    for (const user of users) {
      const after = normalizePhone(user.phone);
      if (after === user.phone) {
        rows.push({ who: user.name, from: user.phone, to: null, blocked: 'Not a recognisable Indian mobile number — needs fixing by hand' });
        continue;
      }
      // The common blocker: the same person registered twice, once before the
      // format was fixed and once after. Writing the normalized number onto
      // the old record collides with the newer one.
      const clash = await User.findOne({ phone: after }).select('name').lean();
      rows.push({
        who: user.name,
        from: user.phone,
        to: after,
        blocked: clash ? `"${clash.name}" already uses ${after} — these two accounts are the same person and need merging by hand` : null
      });
    }
    return {
      summary: `${rows.filter(r => !r.blocked).length} account(s) can be repaired, ${rows.filter(r => r.blocked).length} need attention`,
      rows
    };
  },
  async apply() {
    const users = await User.find({ phone: { $exists: true, $ne: null, $not: /^\+/ } });
    const done = [];
    const failed = [];
    for (const user of users) {
      const before = user.phone;
      const after = normalizePhone(before);
      if (after === before) {
        failed.push({ who: user.name, from: before, reason: 'Not a recognisable Indian mobile number' });
        continue;
      }
      user.phone = after;
      try {
        await user.save();
        done.push({ who: user.name, from: before, to: after });
      } catch (err) {
        // One account that cannot be saved must not stop the rest — that is
        // exactly how the original script left everything after the first
        // failure unfixed.
        failed.push({
          who: user.name,
          from: before,
          reason: err.code === 11000 ? `Another account already uses ${after}` : err.message
        });
      }
    }
    return { summary: `${done.length} repaired, ${failed.length} could not be`, done, failed };
  }
});

// ---------------------------------------------------------------------------
const FEED_TOGGLE_LABELS = {
  search: 'Search box',
  locationFilter: 'Location filter',
  tagsSidebar: 'Categories sidebar',
  fab: 'Floating "Raise an Issue" button',
  scrollTop: 'Scroll to top/bottom button'
};

register({
  id: 'feed-toggle-labels',
  name: 'Bring the Feed switch labels up to date',
  why: 'The labels beside these switches are stored in the database, so renaming one in the code only reaches a brand-new site. This is what makes "Tags sidebar" read "Categories sidebar" here.',
  danger: false,
  async preview() {
    const blocks = await PageBlock.find({ page: 'feed-toggles' }).lean();
    const rows = blocks
      .filter(b => FEED_TOGGLE_LABELS[b.config?.key] && b.config.label !== FEED_TOGGLE_LABELS[b.config.key])
      .map(b => ({ key: b.config.key, from: b.config.label, to: FEED_TOGGLE_LABELS[b.config.key] }));
    return { summary: rows.length ? `${rows.length} label(s) out of date` : 'All labels already up to date', rows };
  },
  async apply() {
    const changed = [];
    for (const [key, label] of Object.entries(FEED_TOGGLE_LABELS)) {
      const result = await PageBlock.updateOne(
        { page: 'feed-toggles', 'config.key': key, 'config.label': { $ne: label } },
        { $set: { 'config.label': label } }
      );
      if (result.modifiedCount) changed.push({ key, to: label });
    }
    return { summary: `${changed.length} label(s) updated`, done: changed };
  }
});

// ---------------------------------------------------------------------------
const MENU_PAGES = ['topnav-links', 'footer-platform', 'footer-account', 'footer-legal'];
const RETIRED_LINK_FILTER = {
  type: 'link',
  page: { $in: MENU_PAGES },
  $or: [{ 'config.href': '/founders-message' }, { 'config.label': /founder/i }]
};

register({
  id: 'retired-links',
  name: 'Delete menu links to pages that no longer exist',
  why: 'The Founder\'s Message page was merged into About. The menu links to it are stored in the database and outlived the page. They are already hidden from visitors, but the rows are still there.',
  danger: true,
  async preview() {
    const blocks = await PageBlock.find(RETIRED_LINK_FILTER).lean();
    return {
      summary: blocks.length ? `${blocks.length} link(s) would be deleted` : 'Nothing to delete',
      rows: blocks.map(b => ({ menu: b.page, label: b.config?.label, href: b.config?.href }))
    };
  },
  async apply() {
    const blocks = await PageBlock.find(RETIRED_LINK_FILTER).lean();
    const result = await PageBlock.deleteMany(RETIRED_LINK_FILTER);
    return {
      summary: `${result.deletedCount} link(s) deleted`,
      done: blocks.map(b => ({ menu: b.page, label: b.config?.label }))
    };
  }
});

// ---------------------------------------------------------------------------
const FOUNDER_HEADING = {
  oldEyebrow: 'From the Founder',
  newEyebrow: 'Reformers Voice',
  oldText: 'A message from our founder.',
  newText: 'A message to fellow reformers.'
};

register({
  id: 'founder-section-rename',
  name: 'Retitle the personal message on the About page',
  why: 'The heading is stored in the database. Only wording still carrying the old text is changed, so anything edited by hand since is left alone.',
  danger: false,
  async preview() {
    const block = await PageBlock.findOne({ page: 'founder-message-body', type: 'heading' }).lean();
    if (!block) return { summary: 'No heading stored — the About page is using the wording built into the code', rows: [] };
    const rows = [];
    if (block.config?.eyebrow === FOUNDER_HEADING.oldEyebrow) rows.push({ field: 'Small label', from: block.config.eyebrow, to: FOUNDER_HEADING.newEyebrow });
    if (block.config?.text === FOUNDER_HEADING.oldText) rows.push({ field: 'Heading', from: block.config.text, to: FOUNDER_HEADING.newText });
    return {
      summary: rows.length ? `${rows.length} line(s) would change` : `Already reads "${block.config?.eyebrow}" / "${block.config?.text}"`,
      rows
    };
  },
  async apply() {
    const eyebrow = await PageBlock.updateMany(
      { page: 'founder-message-body', type: 'heading', 'config.eyebrow': FOUNDER_HEADING.oldEyebrow },
      { $set: { 'config.eyebrow': FOUNDER_HEADING.newEyebrow } }
    );
    const text = await PageBlock.updateMany(
      { page: 'founder-message-body', type: 'heading', 'config.text': FOUNDER_HEADING.oldText },
      { $set: { 'config.text': FOUNDER_HEADING.newText } }
    );
    const total = eyebrow.modifiedCount + text.modifiedCount;
    return { summary: total ? `${total} line(s) updated` : 'Nothing needed changing', done: [] };
  }
});

// ---------------------------------------------------------------------------
const byId = (id) => JOBS.find(job => job.id === id);

// What the screen lists — never the functions themselves.
exports.list = () => JOBS.map(({ id, name, why, danger }) => ({ id, name, why, danger }));
exports.preview = async (id) => {
  const job = byId(id);
  if (!job) return null;
  return { id: job.id, name: job.name, ...(await job.preview()) };
};
exports.apply = async (id) => {
  const job = byId(id);
  if (!job) return null;
  return { id: job.id, name: job.name, ...(await job.apply()) };
};
exports.JOBS = JOBS;
