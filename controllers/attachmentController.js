const Issue = require('../models/Issue');
const attachmentStore = require('../services/attachmentStore');
const { isStaff } = require('../middleware/auth');

// Only touch GCS when it's actually configured — required lazily so local
// dev without any Google Cloud credentials never loads config/gcs.js at all.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

// POST /api/attachments/:issueId  (multipart, field name "attachments", up to 6 files)
exports.upload = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    const isOwner = String(issue.reporter) === String(req.user._id);
    if (!isOwner && !isStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    // Same edit window as issueController.update's owner/staff split — once
    // a report has been reviewed, its own reporter can no longer change
    // what staff saw, including its photos.
    if (isOwner && !isStaff(req.user) && issue.moderationStatus !== 'Pending') {
      return res.status(403).json({ success: false, message: 'This report has already been reviewed and can no longer be edited.' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Same storage path as posting a new report (issueController.create), so
    // the two can't drift — and same all-or-nothing behaviour: a failure
    // partway through removes what it already stored rather than leaving half
    // an upload attached.
    const stored = await attachmentStore.storeFiles(req.files);
    issue.attachments.push(...stored);
    try {
      await issue.save();
    } catch (err) {
      await attachmentStore.discard(stored);
      throw err;
    }
    res.status(201).json({ success: true, attachments: issue.attachments });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/attachments/:issueId/:attachmentId
exports.remove = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    const isOwner = String(issue.reporter) === String(req.user._id);
    if (!isOwner && !isStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (isOwner && !isStaff(req.user) && issue.moderationStatus !== 'Pending') {
      return res.status(403).json({ success: false, message: 'This report has already been reviewed and can no longer be edited.' });
    }
    const attachment = issue.attachments.find(a => String(a._id) === req.params.attachmentId);
    if (useGCS && attachment) {
      await gcs.deleteFile(attachment.fileName).catch(() => {});
    }
    issue.attachments = issue.attachments.filter(a => String(a._id) !== req.params.attachmentId);
    await issue.save();
    res.json({ success: true, attachments: issue.attachments });
  } catch (err) {
    next(err);
  }
};
