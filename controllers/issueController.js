const Issue = require('../models/Issue');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');
const { notify } = require('../services/notifyService');
const { buildIssueThankYouMessage } = require('../services/emailTemplate');
const { translateIssueFields } = require('../services/translationService');
const ogImage = require('../services/ogImageService');
const attachmentStore = require('../services/attachmentStore');
const activity = require('./activityController');
const { log: auditLog } = require('./auditController');
const { isStaff } = require('../middleware/auth');
const { isAllowedIndia } = require('../utils/geoCheck');

const ISSUE_TRANSLATABLE_FIELDS = ['title', 'description'];

// How long an identical report from the same person counts as "the same
// submission being tried again" rather than a genuinely new one. Posting a
// report is a deliberate, one-off act — nobody files the same wording twice in
// ten minutes on purpose, but someone whose first attempt *looked* like it
// failed will absolutely press the button again, three or four times.
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

// Ceiling for a public list request that didn't ask for a page size — see the
// list handler. Well above what any screen shows at once, low enough that the
// response can't grow without bound.
const PUBLIC_LIST_CAP = 100;

// Approval is the moment a post becomes shareable, and the moment its link
// preview starts mattering — before it, the link deliberately previews as the
// plain site card (see server.js). Building the card here, rather than
// leaving it to whichever crawler asks first, is what keeps that first share
// fast: rendering takes seconds, and a crawler that waits that long shows a
// bare link and then remembers it for weeks. Awaited on purpose — this runs
// inside an admin's approve action or the auto-approval sweep, where a couple
// of seconds costs nobody anything, and a fire-and-forget render would risk
// being cut short when the container's CPU is released after the response.
// Never allowed to fail an approval: the crawler path still renders on demand.
async function prepareSharePreview(issue) {
  try {
    await ogImage.cardFor(ogImage.pickPreviewImage(issue.attachments));
  } catch (err) {
    console.error(`Could not pre-build the share preview for issue ${issue._id}:`, err.message);
  }
}

// Exported so scripts/translateExistingIssues.js can reuse this exact
// logic to backfill issues created before this feature existed — those
// never got a create()/update() call through this controller to fire it.
//
// Fired without awaiting (see create()/update() below), unlike
// articleController's refreshTranslations — posting/editing an issue is a
// high-frequency, interactive citizen action, not a curated admin publish,
// so it shouldn't wait several seconds on translation API calls before
// responding. Uses an atomic findByIdAndUpdate rather than re-saving a
// held-onto document, since by the time this resolves the issue may have
// been independently modified (e.g. moderated) — never throws.
exports.refreshIssueTranslations = refreshIssueTranslations;
async function refreshIssueTranslations(issueId, title, description) {
  try {
    const fields = {};
    if (title) fields.title = title;
    if (description) fields.description = description;
    const { detectedLanguage, translations } = await translateIssueFields(fields);
    if (!detectedLanguage) return;
    await Issue.findByIdAndUpdate(issueId, { originalLanguage: detectedLanguage, translations });
  } catch (err) {
    console.error(`Failed to translate issue ${issueId}:`, err.message);
  }
}

// Overlays the requested language's translated title/description onto an
// issue — EXCEPT for the issue's own reporter (same isOwner comparison used
// throughout this file for edit/delete permission checks), who always sees
// their own post exactly as they wrote it. Everyone else, including
// Admin/Authority, sees the translated version like any other viewer — staff
// reviewing a queue of issues posted in whatever regional language need to
// be able to read them in English too, same as a citizen viewer would. Also
// a no-op when the requested language IS the language the issue was
// actually written in. Falls back to the original per-field (never a blank
// field) when a translation is missing — API not configured, still pending
// (fires async after create/update), or that language's call failed.
//
// Note: if staff edits title/description while viewing a translated
// version (PATCH /api/issues/:id, "staff can edit content at any time"
// below), whatever text is in the edit form gets saved as the new content,
// and refreshIssueTranslations then re-detects its language from that —
// so correcting text while looking at an English translation re-establishes
// the issue as English-authored from that point on. Acceptable today: staff
// edits are already rare manual corrections, not routine moderation actions.
function applyLang(issue, lang, viewer) {
  const plain = issue.toObject ? issue.toObject() : { ...issue };
  // The client never reads the raw translations blob directly — it only
  // ever sees whichever single language's title/description this function
  // resolves below — so it's dropped from every response regardless of which
  // branch returns, rather than shipping up to 8 languages' worth of text
  // over the wire for every issue on every request. Captured before the
  // delete so the lookup below still has it to work with.
  const translations = plain.translations;
  delete plain.translations;
  const isOwner = viewer && String(plain.reporter?._id || plain.reporter) === String(viewer._id);
  if (isOwner) return plain;
  const targetLang = lang || 'en';
  if (targetLang === plain.originalLanguage) return plain;
  const t = translations?.[targetLang];
  if (!t) return plain;
  const result = { ...plain };
  ISSUE_TRANSLATABLE_FIELDS.forEach(f => { if (t[f]) result[f] = t[f]; });
  return result;
}

const CUSTOM_CATEGORY_PATTERN = /^[A-Za-z0-9 &-]{4,30}$/;

// Search input goes straight into a Mongo regex, so it needs to be treated
// as literal text, not as a regular expression someone typed into a text
// box — otherwise a stray `(`, `.`, `+` etc. either throws (invalid regex,
// 500) or, worse, a crafted pattern like `(a+)+$` causes catastrophic
// backtracking (a real DoS vector on a public, unauthenticated endpoint).
// `*` is the one character treated as an intentional wildcard (any
// characters) after escaping everything else, so a search like
// "near*park" matches "near the central park" — "search anywhere in the
// string" without reopening the regex-injection hole.
function toSearchRegex(input) {
  const escaped = String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\\\*/g, '.*');
  return new RegExp(withWildcards, 'i');
}

function validateClassification(topic, subTopic, customCategory) {
  if (!topic || !Issue.CATEGORIES.includes(topic)) return 'Please select a valid topic.';
  const allowedSubTopics = Issue.TOPIC_HIERARCHY[topic] || [];
  if (!subTopic || !allowedSubTopics.includes(subTopic)) return 'Please select a valid sub topic.';
  if ((topic === 'Other' || subTopic === 'Other') && !CUSTOM_CATEGORY_PATTERN.test(customCategory || '')) {
    return 'Specify your category using 4–30 letters, numbers, spaces, hyphens, or ampersands.';
  }
  if (customCategory && !CUSTOM_CATEGORY_PATTERN.test(customCategory)) {
    return 'Specify your category using 4–30 letters, numbers, spaces, hyphens, or ampersands.';
  }
  return null;
}

// A non-negative integer from a settings value, falling back to `def` for
// anything blank/invalid/negative.
function toNonNegativeInt(raw, def) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

// Reads the admin-configurable auto-approval settings, with safe fallbacks
// if they've never been saved yet (settingsController seeds these
// defaults on first visit to the Control Panel, but issues can be created
// before that ever happens). Days/hours/minutes combine — "1 day 2 hours
// 15 minutes" is set as three separate values, not picked from a dropdown.
async function getAutoApprovalConfig() {
  const rows = await SystemSetting.find({
    key: { $in: ['AUTO_APPROVAL_ENABLED', 'AUTO_APPROVAL_DAYS', 'AUTO_APPROVAL_HOURS', 'AUTO_APPROVAL_MINUTES'] }
  });
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const days = toNonNegativeInt(byKey.AUTO_APPROVAL_DAYS, 1);
  const hours = toNonNegativeInt(byKey.AUTO_APPROVAL_HOURS, 0);
  const minutes = toNonNegativeInt(byKey.AUTO_APPROVAL_MINUTES, 0);
  let ms = (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60) * 1000;
  // A misconfigured all-zero duration would auto-approve instantly — fall
  // back to the 24-hour default instead of silently doing that.
  if (ms <= 0) ms = 24 * 60 * 60 * 1000;

  return { enabled: byKey.AUTO_APPROVAL_ENABLED !== 'false', days, hours, minutes, ms };
}

function formatDuration({ days, hours, minutes }) {
  const parts = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  return parts.length ? parts.join(' ') : '24 hours';
}

// Approves any Pending post that's been waiting longer than the current
// auto-approval window — called lazily on the read paths below rather than
// a background cron job, since Cloud Run instances aren't guaranteed to
// stay alive for a timer between requests. The cutoff is computed fresh
// from the *current* setting every time, not a value frozen at the post's
// creation time — so changing the admin setting immediately applies to
// every already-pending post, not just new ones going forward. A disabled
// setting is a full kill switch: nothing gets auto-approved until it's
// re-enabled, no matter how overdue.
async function autoApproveOverdue() {
  const config = await getAutoApprovalConfig();
  if (!config.enabled) return;

  const cutoff = new Date(Date.now() - config.ms);
  const overdue = await Issue.find({ moderationStatus: 'Pending', createdAt: { $lte: cutoff } });
  for (const issue of overdue) {
    issue.moderationStatus = 'Approved';
    issue.moderatedAt = new Date();
    await issue.save();
    await prepareSharePreview(issue);
    await activity.log(issue._id, issue.reporter, 'moderation', 'Automatically approved — no reviewer within the time limit');
    await notify(issue.reporter, {
      title: 'Your issue was approved',
      message: `"${issue.title}" is now live on the feed (automatically approved after the review window passed).`,
      link: `/issues/${issue._id}`,
      image: issue.attachments?.[0]?.url
    });
  }
}

// GET /api/issues?status=&category=&mine=&q=&moderation=all&city=&priority=
// Public callers only ever see Approved posts. A signed-in citizen viewing
// their own issues (mine=true) sees all of their own regardless of
// moderation state. Staff can pass moderation=all to see everything (the
// Control Panel's moderation queue).
exports.list = async (req, res, next) => {
  try {
    await autoApproveOverdue();
    // Query-string params can arrive as nested objects (e.g. ?status[$ne]=x
    // parses to { $ne: 'x' }) — coerced to plain strings before they ever
    // reach a Mongo filter, so a crafted query string can't smuggle in an
    // operator like $ne/$gt in place of an expected value.
    const { status, category, q, mine, moderation, city, priority, location, lat, lng, radiusKm, page, limit } = req.query;
    const str = (v) => (v === undefined ? undefined : String(v));
    const filter = {};
    if (status) filter.status = str(status);
    if (category) filter.category = str(category);
    if (priority) filter.priority = str(priority);
    if (city) filter['location.city'] = new RegExp(`^${toSearchRegex(str(city)).source}$`, 'i');

    // A picked map suggestion (lat/lng from the Feed's Google Places search)
    // takes priority over the plain-text `location` filter below — Google's
    // suggestion is a full formatted address (e.g. "MG Road, Nellore,
    // Andhra Pradesh 524001, India"), which would never substring-match the
    // short city/state/district values actually stored on an issue, so
    // applying both as an AND would always return zero results. $near is
    // strictly more precise than substring matching against the same point
    // anyway.
    const latNum = lat !== undefined ? Number(lat) : NaN;
    const lngNum = lng !== undefined ? Number(lng) : NaN;
    const usingNear = Number.isFinite(latNum) && Number.isFinite(lngNum);
    if (usingNear) {
      const radiusNum = Math.min(200, Math.max(1, Number(radiusKm) || 10));
      filter['location.geo'] = {
        $near: { $geometry: { type: 'Point', coordinates: [lngNum, latNum] }, $maxDistance: radiusNum * 1000 }
      };
    }

    const andClauses = [];
    if (q) andClauses.push({ $or: [{ title: toSearchRegex(str(q)) }, { description: toSearchRegex(str(q)) }] });
    if (location && !usingNear) {
      const loc = toSearchRegex(str(location));
      andClauses.push({ $or: [
        { 'location.state': loc },
        { 'location.district': loc },
        { 'location.mandal': loc },
        { 'location.city': loc },
        // Fine-grained searches (an apartment/building name, a landmark) only
        // ever live in the free-text address a reporter typed — everything
        // above is state/district/mandal/city, which can never match that.
        { 'location.address': loc }
      ] });
    }
    if (andClauses.length) filter.$and = andClauses;

    let publicFeed = false;
    if (mine === 'true' && req.user) {
      filter.reporter = req.user._id;
    } else if (moderation === 'all' && isStaff(req.user)) {
      // no moderation restriction — staff reviewing the full queue
    } else {
      filter.moderationStatus = 'Approved';
      publicFeed = true;
    }

    // An Authority account ("Admin" in the UI) hitting the feed in this same
    // shape a public visitor would (no mine=, no moderation=all) is exactly
    // the Home/Feed pages' own fetch — gated by the Super Admin's per-account
    // grant (User.canAccessHomeFeed). Deliberately does not touch the
    // moderation=all branch above, which the Authority account's own
    // Control Panel moderation queue relies on. Read fresh from the DB
    // rather than trusting req.user's session snapshot, so a grant/revoke
    // takes effect immediately instead of waiting for that session to
    // refresh — same reasoning as canCreateCitizens's own fresh lookup in
    // userAdminController.js.
    if (publicFeed && req.user && req.user.role === 'Authority') {
      const requester = await User.findById(req.user._id).select('canAccessHomeFeed');
      if (!requester?.canAccessHomeFeed) {
        return res.status(403).json({ success: false, message: 'Home and Issues feed access has been restricted for your account by the Super Admin.' });
      }
    }

    // The public feed should read "latest first" by when a post actually
    // went live, not when it was originally submitted — otherwise a post
    // that sat in the moderation queue a while surfaces buried under posts
    // submitted (and approved) after it. moderatedAt is set on every
    // approval (manual or auto — see autoApproveOverdue above), so it's
    // reliably present here; other views keep sorting by createdAt since
    // most of what they show has no moderatedAt yet.
    const sort = publicFeed ? { moderatedAt: -1, createdAt: -1 } : { createdAt: -1 };

    let query = Issue.find(filter)
      .populate('reporter', 'name role')
      .populate('assignee', 'name role')
      .populate('lastUpdatedBy', 'name role');
    // $near already returns results ordered by distance — Mongo rejects a
    // query that combines it with an explicit sort on other fields.
    if (!usingNear) query = query.sort(sort);

    // Pagination is opt-in via `limit` — a caller that doesn't pass it (the
    // Control Panel's moderation queue, "My Issues") gets the exact same
    // unpaginated `{ issues }` shape as before. Callers that do pass it (the
    // public Feed, Home page) also get `total`/`hasMore` back, so a growing
    // issue count doesn't mean every filter change on the public feed ships
    // the entire collection down the wire.
    let total;
    if (limit) {
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      total = await Issue.countDocuments(filter);
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    } else if (publicFeed) {
      // Opt-in pagination left one case unbounded: a public, unauthenticated
      // request with no `limit` was answered with the entire approved
      // collection, reporter documents joined in. That is a free bulk export
      // of the site to anyone who asks, and it grows without limit — the
      // response size is decided by how many reports have ever been filed.
      // The app's own callers all pass a limit (the Feed and Home pages) or
      // are the signed-in views this branch doesn't cover ("My Issues", the
      // moderation queue), so this ceiling only ever bites a caller that
      // didn't say what it wanted.
      query = query.limit(PUBLIC_LIST_CAP);
    }

    const issues = await query;
    const payload = { success: true, issues: issues.map(i => applyLang(i, req.query.lang, req.user)) };
    if (total !== undefined) payload.total = total;
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/stats  -> counts used by dashboards
exports.stats = async (req, res, next) => {
  try {
    const [total, open, inProgress, resolved, pending, escalated] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: 'Open' }),
      Issue.countDocuments({ status: 'In Progress' }),
      Issue.countDocuments({ status: 'Resolved' }),
      Issue.countDocuments({ moderationStatus: 'Pending' }),
      Issue.countDocuments({ status: 'Escalated' })
    ]);
    res.json({ success: true, stats: { total, open, inProgress, resolved, pending, escalated } });
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/:id  -> a Pending/Rejected post is only visible to its
// owner or staff; everyone else gets a 404 (no leaking existence/content).
exports.get = async (req, res, next) => {
  try {
    await autoApproveOverdue();
    const issue = await Issue.findById(req.params.id)
      .populate('reporter', 'name role')
      .populate('assignee', 'name role')
      .populate('lastUpdatedBy', 'name role')
      .populate('supporters', 'name')
      .populate('disagrees', 'name');
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    if (issue.moderationStatus !== 'Approved') {
      const isOwner = req.user && String(issue.reporter._id || issue.reporter) === String(req.user._id);
      if (!isOwner && !isStaff(req.user)) {
        return res.status(404).json({ success: false, message: 'Issue not found' });
      }
    }
    res.json({ success: true, issue: applyLang(issue, req.query.lang, req.user) });
  } catch (err) {
    next(err);
  }
};

// POST /api/issues  -> always starts Pending; only visible publicly once approved.
exports.create = async (req, res, next) => {
  try {
    // Every rejection below has to throw away the uploads that came with it.
    // multer has already taken the files by the time this runs, so a
    // submission turned away for a missing location would otherwise leave its
    // photos behind with no report to belong to.
    const reject = async (status, message) => {
      await attachmentStore.discardUploads(req.files);
      return res.status(status).json({ success: false, message });
    };

    const { title, description, topic, subTopic, customCategory, priority, timezone } = req.body;
    // A form that carries files is multipart, where every field arrives as
    // text — so the nested location object comes through as JSON. A plain
    // JSON caller (the API docs, any script) still sends it as an object.
    let location = req.body.location;
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch {
        return reject(400, "The location couldn't be read. Pick the address again and resubmit.");
      }
    }

    if (!title || !description) {
      return reject(400, 'Add a description of the issue before posting.');
    }
    const hasAddress = !!(location && location.address && String(location.address).trim());
    const hasStructuredLocation = !!(location && location.state && location.district && location.city
      && String(location.state).trim() && String(location.district).trim() && String(location.city).trim());
    if (!hasAddress && !hasStructuredLocation) {
      return reject(400, 'Location is required — provide an address, or State, District and City');
    }
    const classificationError = validateClassification(topic, subTopic, customCategory);
    if (classificationError) return reject(400, classificationError);

    if (!isAllowedIndia({ ip: req.ip, timezone })) {
      await auditLog({
        user: req.user._id,
        action: 'blocked_non_india_post',
        entity: 'Issue',
        ip: req.ip,
        details: `Blocked issue submission — timezone: ${timezone || 'unknown'}`
      });
      return reject(403, 'Act On Issues currently only supports posts from within India.');
    }

    // Retrying a submission must not file a second report.
    //
    // Posting used to be two requests — create the issue, then upload its
    // photos — so a failed upload showed "Failed to submit issue" next to a
    // report that had already been filed. The reporter pressed the button
    // again, and again: AOI-000203 through AOI-000206 are four copies of one
    // report. Photos now travel with the report (see the route) so that
    // particular split is gone, but a response can still be lost on the way
    // back to a phone on a weak connection, leaving the same impression.
    // An identical report from the same person within the window is therefore
    // treated as the same submission and hands back what was already filed.
    //
    // Deliberately ahead of storing the files below: a retry that reaches this
    // point returns early, so the photos it re-sent are never written, and the
    // issue it returns already has the copies stored the first time round.
    //
    // Matching on the wording alone would be too blunt: someone reporting five
    // dead streetlights in one sitting writes the same sentence five times and
    // means it every time. The location has to match as well — a retry
    // resubmits the identical form, a second real report does not. Candidates
    // are narrowed in the query and compared here, where a missing field and
    // an empty one can be treated as the same thing without contorting the
    // query to say so.
    const sameText = await Issue.find({
      reporter: req.user._id,
      title,
      description,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) }
    }).sort({ createdAt: -1 });
    const samePlace = (a) => ['address', 'city'].every(field => (
      String(a?.[field] ?? '').trim().toLowerCase() === String(location?.[field] ?? '').trim().toLowerCase()
    ));
    const alreadyFiled = sameText.find(existing => samePlace(existing.location));
    if (alreadyFiled) {
      // The photos sent with the retry are the same ones already attached to
      // the report being returned, so they're dropped rather than stored a
      // second time.
      await attachmentStore.discardUploads(req.files);
      return res.status(200).json({ success: true, issue: alreadyFiled, alreadyFiled: true });
    }

    const autoApproval = await getAutoApprovalConfig();

    // Photos are stored before the report exists, not after, which is what
    // makes a failed submission leave nothing behind: if storage refuses, no
    // report was ever created and the reporter gets an error describing a
    // state that is actually true. storeFiles cleans up after itself if it
    // gets partway through (see services/attachmentStore.js).
    let attachments = [];
    try {
      attachments = await attachmentStore.storeFiles(req.files);
    } catch (err) {
      console.error('Storing the photos for a new report failed, so nothing was posted:', err.message);
      return res.status(502).json({
        success: false,
        message: 'Your photos could not be uploaded, so the report was not posted — nothing was saved. Check your connection and press Raise an Issue again, or remove the photos and post without them.'
      });
    }

    let issue;
    try {
      issue = await Issue.create({
        title,
        description,
        category: topic,
        topic,
        subTopic,
        customCategory: customCategory || undefined,
        priority,
        location,
        attachments,
        reporter: req.user._id
      });
    } catch (err) {
      // The photos are already in storage and now belong to nothing.
      await attachmentStore.discard(attachments);
      throw err;
    }
    refreshIssueTranslations(issue._id, issue.title, issue.description);

    // Past this line the report is filed and the submission has succeeded.
    // Everything that follows — the activity entry, the bell notification and
    // the email/push/WhatsApp it fans out to — is about telling people it
    // happened, and none of it can undo the record that already exists. Left
    // unguarded, a failure in any of them (a rejected notification write, an
    // email provider having a bad minute) reached the browser as "Failed to
    // submit issue", which is not only wrong but actively harmful: it invites
    // the reporter to submit the same thing again.
    try {
      await activity.log(issue._id, req.user._id, 'created', 'Issue submitted for review');
      await notify(req.user._id, {
        title: 'Your issue was submitted',
        message: `"${issue.title}" — ${issue.description} — is being reviewed and should go live within about 15 minutes. It will be automatically approved within ${formatDuration(autoApproval)} even if no one reviews it sooner.`,
        link: `/issues/${issue._id}`,
        emailMessage: buildIssueThankYouMessage(issue, req.user.name),
        emailMessageIsHtml: true,
        emailButtonLabel: 'View & Share My Report'
      });
    } catch (err) {
      console.error(`Issue ${issue._id} was filed, but a follow-up step failed:`, err.message);
    }

    res.status(201).json({ success: true, issue });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/issues/:id  (owner can edit content; Admin/Authority can regulate:
// status/priority/assignee/featured/commentsLocked/moderationStatus)
exports.update = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const isOwner = String(issue.reporter) === String(req.user._id);
    const staff = isStaff(req.user);
    if (!isOwner && !staff) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { title, description, category, topic, subTopic, customCategory, priority, status, assignee, featured, commentsLocked, moderationStatus, location } = req.body;

    // Once a report has been reviewed (approved or rejected), its own
    // reporter can no longer change what got reviewed — preserves the
    // integrity of what was actually approved. Staff can still edit content
    // at any time (that's how corrections/moderation happen after the fact).
    const editingContent = title !== undefined || description !== undefined || category !== undefined
      || topic !== undefined || subTopic !== undefined || customCategory !== undefined || location !== undefined;
    if (isOwner && !staff && editingContent && issue.moderationStatus !== 'Pending') {
      return res.status(403).json({ success: false, message: 'This report has already been reviewed and can no longer be edited.' });
    }

    let changed = false;
    let contentTranslatable = false;
    if (title !== undefined && title !== issue.title) { issue.title = title; changed = true; contentTranslatable = true; }
    if (description !== undefined && description !== issue.description) { issue.description = description; changed = true; contentTranslatable = true; }
    if (category !== undefined && category !== issue.category) { issue.category = category; changed = true; }
    if (topic !== undefined || subTopic !== undefined || customCategory !== undefined) {
      const nextTopic = topic !== undefined ? topic : issue.topic;
      const nextSubTopic = subTopic !== undefined ? subTopic : issue.subTopic;
      const nextCustomCategory = customCategory !== undefined ? customCategory : issue.customCategory;
      const classificationError = validateClassification(nextTopic, nextSubTopic, nextCustomCategory);
      if (classificationError) return res.status(400).json({ success: false, message: classificationError });
      if (nextTopic !== issue.topic) { issue.topic = nextTopic; issue.category = nextTopic; changed = true; }
      if (nextSubTopic !== issue.subTopic) { issue.subTopic = nextSubTopic; changed = true; }
      if (nextCustomCategory !== issue.customCategory) { issue.customCategory = nextCustomCategory || undefined; changed = true; }
    }

    if (location !== undefined) {
      const hasAddress = !!(location.address && String(location.address).trim());
      const hasStructuredLocation = !!(location.state && location.district && location.city
        && String(location.state).trim() && String(location.district).trim() && String(location.city).trim());
      if (!hasAddress && !hasStructuredLocation) {
        return res.status(400).json({ success: false, message: 'Location is required — provide an address, or State, District and City' });
      }
      for (const field of ['address', 'city', 'ward', 'district', 'mandal', 'state', 'lat', 'lng']) {
        if (location[field] !== undefined && location[field] !== issue.location?.[field]) {
          issue.location[field] = location[field];
          changed = true;
        }
      }
    }

    // Only Admin/Authority may regulate workflow fields.
    if (staff) {
      if (priority !== undefined && priority !== issue.priority) { issue.priority = priority; changed = true; }
      if (assignee !== undefined && String(assignee || '') !== String(issue.assignee || '')) { issue.assignee = assignee || null; changed = true; }
      if (status !== undefined && status !== issue.status) {
        const closing = status === 'Resolved' || status === 'Rejected';
        issue.status = status;
        changed = true;
        await activity.log(issue._id, req.user._id, 'status', `Status changed to ${status}`);
        if (!isOwner) {
          await notify(issue.reporter, {
            title: 'Your issue status was updated',
            message: `"${issue.title}" is now marked ${status}.`,
            link: `/issues/${issue._id}`,
            image: issue.attachments?.[0]?.url
          });
        }
        // A resolved/rejected issue can no longer be a hot topic and stops taking new comments.
        if (closing && issue.featured) {
          issue.featured = false;
          await activity.log(issue._id, req.user._id, 'featured', 'Removed from hot topics (issue resolved/rejected)');
        }
        if (closing && !issue.commentsLocked) {
          issue.commentsLocked = true;
          await activity.log(issue._id, req.user._id, 'comments', 'Locked comments (issue resolved/rejected)');
        }
      }
      if (featured !== undefined && featured !== issue.featured) {
        if (featured && (issue.status === 'Resolved' || issue.status === 'Rejected')) {
          return res.status(400).json({ success: false, message: 'A resolved or rejected issue cannot be marked as a hot topic.' });
        }
        // Whichever moderation status this request leaves the issue in —
        // its own moderationStatus change if provided, otherwise its
        // current one — must be Approved before it can be featured.
        const effectiveModerationStatus = moderationStatus !== undefined ? moderationStatus : issue.moderationStatus;
        if (featured && effectiveModerationStatus !== 'Approved') {
          return res.status(400).json({ success: false, message: 'An issue must be approved before it can be marked as a hot topic.' });
        }
        issue.featured = featured;
        changed = true;
        await activity.log(issue._id, req.user._id, 'featured', featured ? 'Marked as hot topic' : 'Removed from hot topics');
      }
      if (commentsLocked !== undefined && commentsLocked !== issue.commentsLocked) {
        issue.commentsLocked = commentsLocked;
        changed = true;
        await activity.log(issue._id, req.user._id, 'comments', commentsLocked ? 'Locked comments' : 'Unlocked comments');
      }
      if (moderationStatus !== undefined && Issue.MODERATION_STATUSES.includes(moderationStatus) && moderationStatus !== issue.moderationStatus) {
        issue.moderationStatus = moderationStatus;
        issue.moderatedBy = req.user._id;
        issue.moderatedAt = new Date();
        changed = true;
        await activity.log(issue._id, req.user._id, 'moderation', `Post ${moderationStatus.toLowerCase()}`);
        if (moderationStatus === 'Approved') await prepareSharePreview(issue);
        await auditLog({
          user: req.user._id,
          action: 'moderate_issue',
          entity: 'Issue',
          entityId: issue._id,
          ip: req.ip,
          details: `${issue.title}: moderation -> ${moderationStatus}`
        });
        await notify(issue.reporter, {
          title: moderationStatus === 'Approved' ? 'Your issue was approved' : 'Your issue was not approved',
          message: moderationStatus === 'Approved'
            ? `"${issue.title}" is now live on the feed.`
            : `"${issue.title}" was reviewed and not approved for posting.`,
          link: `/issues/${issue._id}`,
          image: issue.attachments?.[0]?.url
        });
      }
    }
    if (changed) issue.lastUpdatedBy = req.user._id;
    await issue.save();
    if (contentTranslatable) refreshIssueTranslations(issue._id, issue.title, issue.description);
    await issue.populate([{ path: 'reporter', select: 'name role' }, { path: 'assignee', select: 'name role' }, { path: 'lastUpdatedBy', select: 'name role' }]);
    res.json({ success: true, issue: applyLang(issue, req.query.lang, req.user) });
  } catch (err) {
    next(err);
  }
};

// POST /api/issues/:id/support  (toggle current user's support — mutually
// exclusive with disagreeing, like a classic like/dislike pair)
exports.toggleSupport = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    const uid = String(req.user._id);
    const idx = issue.supporters.findIndex(s => String(s) === uid);
    if (idx >= 0) {
      issue.supporters.splice(idx, 1);
    } else {
      issue.supporters.push(req.user._id);
      const dIdx = issue.disagrees.findIndex(s => String(s) === uid);
      if (dIdx >= 0) issue.disagrees.splice(dIdx, 1);
    }
    await issue.save();
    res.json({
      success: true,
      supportCount: issue.supporters.length,
      supported: idx < 0,
      disagreeCount: issue.disagrees.length,
      disagreed: issue.disagrees.some(s => String(s) === uid)
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/issues/:id/disagree  (toggle current user's disagree — mutually
// exclusive with supporting)
exports.toggleDisagree = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    const uid = String(req.user._id);
    const idx = issue.disagrees.findIndex(s => String(s) === uid);
    if (idx >= 0) {
      issue.disagrees.splice(idx, 1);
    } else {
      issue.disagrees.push(req.user._id);
      const sIdx = issue.supporters.findIndex(s => String(s) === uid);
      if (sIdx >= 0) issue.supporters.splice(sIdx, 1);
    }
    await issue.save();
    res.json({
      success: true,
      disagreeCount: issue.disagrees.length,
      disagreed: idx < 0,
      supportCount: issue.supporters.length,
      supported: issue.supporters.some(s => String(s) === uid)
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/issues/:id  (Admin/Authority moderating only — the reporter
// can no longer delete their own post, per the "once posted, it's posted"
// policy; they can still edit it while it's Pending review instead)
exports.remove = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (!isStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await auditLog({
      user: req.user._id,
      action: 'delete_issue',
      entity: 'Issue',
      entityId: issue._id,
      ip: req.ip,
      details: `Moderated delete: ${issue.title}`
    });
    await issue.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/meta  -> enum options for building forms
exports.meta = async (req, res, next) => {
  try {
    const autoApproval = await getAutoApprovalConfig();
    res.json({
      success: true,
      categories: Issue.CATEGORIES,
      topicHierarchy: Issue.TOPIC_HIERARCHY,
      statuses: Issue.STATUSES,
      priorities: Issue.PRIORITIES,
      moderationStatuses: Issue.MODERATION_STATUSES,
      states: Issue.INDIAN_STATES,
      autoApprovalEnabled: autoApproval.enabled,
      autoApprovalDays: autoApproval.days,
      autoApprovalHours: autoApproval.hours,
      autoApprovalMinutes: autoApproval.minutes,
      autoApprovalLabel: formatDuration(autoApproval)
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/featured  -> public "hot topics" for the home page carousel
exports.featured = async (req, res, next) => {
  try {
    const issues = await Issue.find({
      featured: true,
      moderationStatus: 'Approved',
      status: { $nin: ['Resolved', 'Rejected'] }
    })
      .populate('reporter', 'name role')
      .sort({ updatedAt: -1 })
      .limit(15);
    res.json({ success: true, issues: issues.map(i => applyLang(i, req.query.lang, req.user)) });
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/category-counts  -> public tag/category counts for the trending strip
exports.categoryCounts = async (req, res, next) => {
  try {
    const rows = await Issue.aggregate([
      { $match: { moderationStatus: 'Approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, categories: rows.map(r => ({ category: r._id, count: r.count })) });
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/top-reporters  -> public leaderboard for the "Top Voices" section
exports.topReporters = async (req, res, next) => {
  try {
    const rows = await Issue.aggregate([
      { $match: { moderationStatus: 'Approved' } },
      { $group: { _id: '$reporter', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, userId: '$user._id', name: '$user.name', role: '$user.role', avatar: '$user.avatar', count: 1 } }
    ]);
    res.json({ success: true, reporters: rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/issues/backfill-translations — Super Admin only (see
// routes/adminRoutes.js). One-time (but safe to re-run) catch-up for issues
// posted before translation existed, or before GOOGLE_TRANSLATE_API_KEY was
// configured — those never went through refreshIssueTranslations, so they
// still show up in their original language for every viewer. Awaited
// end-to-end rather than fired in the background like a single issue's
// translation: with ~150+ issues this can take a couple of minutes, and
// Cloud Run can freeze a container's CPU once a response is sent, which
// would silently stop an unawaited loop partway through. Safe to interrupt
// (a request timeout) or re-run — each issue is translated independently
// and already-translated ones just get overwritten with the same result.
exports.backfillTranslations = async (req, res, next) => {
  try {
    const issues = await Issue.find().select('title description');
    for (const issue of issues) {
      await refreshIssueTranslations(issue._id, issue.title, issue.description);
    }
    res.json({ success: true, count: issues.length });
  } catch (err) {
    next(err);
  }
};
