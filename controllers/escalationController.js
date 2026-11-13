const path = require('path');
const Issue = require('../models/Issue');
const IssueEscalation = require('../models/IssueEscalation');
const email = require('../services/emailService');
const { buildEmailHtml, buildIssueEscalationMessage } = require('../services/emailTemplate');
const { isValidEmail } = require('../utils/accountValidation');
const { log: auditLog } = require('./auditController');
const activity = require('./activityController');
const { notify } = require('../services/notifyService');

const INBOUND_REPLY_DOMAIN = process.env.INBOUND_REPLY_DOMAIN || 'reply.actonissues.com';
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

// Only touch GCS when it's actually configured — same lazy-require pattern
// as controllers/attachmentController.js, so local dev without Google Cloud
// credentials never loads config/gcs.js at all.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

const isImage = (url) => IMAGE_EXTENSIONS.includes(path.extname(url || '').toLowerCase());

// Accepts a comma/semicolon-separated string (what a plain text input
// sends) or an array, and splits it into valid vs. invalid addresses so the
// caller can reject the request with a specific, actionable message instead
// of silently dropping a typo'd CC address.
function parseEmailList(raw) {
  const items = Array.isArray(raw) ? raw : String(raw || '').split(/[,;]/);
  const cleaned = items.map(e => e.trim()).filter(Boolean);
  const valid = [...new Set(cleaned.filter(isValidEmail))];
  const invalid = cleaned.filter(e => !isValidEmail(e));
  return { valid, invalid };
}

// The issue's own report photos — video attachments are excluded since an
// <img> tag can't render them inline in an email.
function issueImageUrls(issue) {
  return (issue.attachments || []).map(a => a.url).filter(isImage);
}

// Stores newly uploaded files (multer's req.files) the same way
// attachmentController.upload does — GCS if configured, local disk
// otherwise — returning the same {fileName, originalName, url} shape used
// for both Issue.attachments and IssueEscalation.attachments.
async function storeUploadedFiles(files) {
  const stored = [];
  for (const file of files || []) {
    if (useGCS) {
      const { fileName, url } = await gcs.uploadFile(file);
      stored.push({ fileName, originalName: file.originalname, url });
    } else {
      stored.push({ fileName: file.filename, originalName: file.originalname, url: '/uploads/' + file.filename });
    }
  }
  return stored;
}

function buildEscalationHtml({ issue, subject, message, images }) {
  return buildEmailHtml({
    title: subject,
    message: buildIssueEscalationMessage(issue, message, images),
    messageIsHtml: true,
    buttonLabel: 'View on Act On Issues',
    url: `${process.env.SITE_URL || 'http://localhost:5173'}/issues/${issue._id}`,
    footerNote: 'You\'re receiving this because Act On Issues has escalated a civic issue report to your office on behalf of local residents. You can reply directly to this email.'
  });
}

// POST /api/issues/:id/escalate  (Admin/Authority only, see routes/issueRoutes.js)
// Emails a concerned authority with the issue's full details — including its
// own report photos plus any extra images staff attach here — plus the
// staff member's own note, and sets a per-escalation Reply-To address so a
// reply lands back on this exact record via the Brevo inbound-parsing
// webhook (routes/webhookRoutes.js) instead of a personal inbox.
exports.escalate = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const { authorityName, authorityEmail, subject, message, ccEmails } = req.body;
    if (!authorityEmail || !isValidEmail(authorityEmail)) {
      return res.status(400).json({ success: false, message: 'A valid authority email is required' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    const { valid: ccList, invalid: invalidCc } = parseEmailList(ccEmails);
    if (invalidCc.length) {
      return res.status(400).json({ success: false, message: `Invalid CC email address(es): ${invalidCc.join(', ')}` });
    }

    const attachments = await storeUploadedFiles(req.files);
    const images = [...issueImageUrls(issue), ...attachments.map(a => a.url).filter(isImage)];
    const html = buildEscalationHtml({ issue, subject: subject.trim(), message, images });

    // Created before sending so its _id is available for the Reply-To
    // address — status/error is filled in right after based on the result.
    const escalation = await IssueEscalation.create({
      issue: issue._id,
      sentBy: req.user._id,
      authorityName: authorityName?.trim(),
      authorityEmail: authorityEmail.trim(),
      ccEmails: ccList,
      subject: subject.trim(),
      message: html,
      attachments
    });

    try {
      // A single Reply-To covers every recipient, To or CC — whoever
      // actually replies gets matched back to this exact escalation by the
      // inbound webhook regardless of which of them it was (see
      // controllers/webhookController.js), so CC doesn't need its own token.
      await email.sendMail(authorityEmail.trim(), subject.trim(), html, {
        replyTo: `esc-${escalation._id}@${INBOUND_REPLY_DOMAIN}`,
        cc: ccList.length ? ccList : undefined
      });
    } catch (err) {
      escalation.status = 'Failed';
      escalation.error = err.message;
      await escalation.save();
      return res.status(502).json({ success: false, message: 'Failed to send escalation email: ' + err.message });
    }

    // Only flips the post's own status once the email actually went out —
    // a failed send above returns early and leaves status untouched. Kept
    // idempotent (skip if already Escalated) so re-sending a follow-up
    // escalation to the same or another authority doesn't spam a second
    // "status changed" activity entry/notification.
    if (issue.status !== 'Escalated') {
      issue.status = 'Escalated';
      await issue.save();
      await activity.log(issue._id, req.user._id, 'status', 'Status changed to Escalated (escalated to authority)');
      await notify(issue.reporter, {
        title: 'Your issue was escalated',
        message: `"${issue.title}" has been escalated to ${authorityName?.trim() || authorityEmail.trim()} for action.`,
        link: `/issues/${issue._id}`,
        image: issue.attachments?.[0]?.url
      });
    }

    await auditLog({
      user: req.user._id,
      action: 'escalate_issue',
      entity: 'Issue',
      entityId: issue._id,
      ip: req.ip,
      details: `Escalated "${issue.title}" to ${authorityEmail.trim()}`
    });

    res.status(201).json({ success: true, escalation, issue });
  } catch (err) {
    next(err);
  }
};

// POST /api/issues/:id/escalate/preview  (Admin/Authority only)
// Renders the exact same email HTML that Send would produce, without
// sending anything or creating an IssueEscalation record — powers the eye/
// Preview button in the compose modal. Only reflects the issue's own
// already-uploaded photos; any new images the admin has picked in the
// browser but not yet submitted aren't uploaded yet, so they can't appear
// here — the modal shows those as separate local thumbnails instead.
exports.previewEscalation = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const subject = (req.body.subject || '').trim() || `Escalation: "${issue.title}" (${issue.issueNumber})`;
    const html = buildEscalationHtml({ issue, subject, message: req.body.message || '', images: issueImageUrls(issue) });
    res.json({ success: true, html });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/escalations  (staff-only — every escalation across every
// issue, newest first, so a reply from an authority is discoverable
// without knowing which specific issue it was about. Mirrors the
// per-issue listEscalations below, just unscoped from a single :id.)
exports.adminList = async (req, res, next) => {
  try {
    const escalations = await IssueEscalation.find({})
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name')
      .populate('issue', 'title issueNumber')
      .lean();
    res.json({ success: true, escalations });
  } catch (err) {
    next(err);
  }
};

// GET /api/issues/:id/escalations  (any signed-in user — escalations are
// treated as public-within-the-app accountability info, same spirit as a
// Resolved/Rejected status being visible to everyone; the route itself is
// still gated behind isAuthenticated, so anonymous visitors don't get it)
exports.listEscalations = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id).select('_id').lean();
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const escalations = await IssueEscalation.find({ issue: req.params.id })
      .sort({ createdAt: -1 })
      .populate('sentBy', 'name')
      .lean();
    res.json({ success: true, escalations });
  } catch (err) {
    next(err);
  }
};
