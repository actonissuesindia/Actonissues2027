const Issue = require('../models/Issue');
const { isStaff } = require('./auth');

// One rule for "may this person see this issue?", applied to the issue itself
// and to everything hanging off it.
//
// The rule already existed in issueController.get — a Pending or Rejected post
// is visible only to the person who filed it and to staff, and looks like a
// 404 to anyone else — but its children didn't enforce it: the comment thread
// (GET /api/comments/:issueId) and the moderation timeline
// (GET /api/activity/:issueId) were both unauthenticated and unchecked. An
// issue id is not a secret (the public feed hands them out), so anyone could
// read the discussion on a post held back for review, or the timeline naming
// the staff member who rejected it and when.
//
// Answering 404 rather than 403 is deliberate and matches issueController:
// "this doesn't exist" tells a stranger nothing, where "you're not allowed to
// see this" confirms that something is there.
module.exports = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.issueId || req.params.id).select('reporter moderationStatus');
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    if (issue.moderationStatus !== 'Approved') {
      const isOwner = req.user && String(issue.reporter) === String(req.user._id);
      if (!isOwner && !isStaff(req.user)) {
        return res.status(404).json({ success: false, message: 'Issue not found' });
      }
    }
    // Handlers that need the full document still load it themselves; this is
    // only the gate, and deliberately selects almost nothing.
    req.issueVisibility = issue;
    next();
  } catch (err) {
    // A malformed id is a CastError here, which is a 404 to the caller, not a
    // server fault.
    res.status(404).json({ success: false, message: 'Issue not found' });
  }
};
