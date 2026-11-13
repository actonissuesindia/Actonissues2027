const Comment = require('../models/Comment');
const Issue = require('../models/Issue');
const activity = require('./activityController');
const { isStaff } = require('../middleware/auth');
const { notify } = require('../services/notifyService');

// GET /api/comments/:issueId
exports.list = async (req, res, next) => {
  try {
    const comments = await Comment.find({ issue: req.params.issueId })
      .populate('user', 'name role avatar')
      .sort({ createdAt: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    next(err);
  }
};

// POST /api/comments/:issueId
exports.add = async (req, res, next) => {
  try {
    if (!req.body.text || !req.body.text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.commentsLocked && !isStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Comments are locked for this issue' });
    }
    let parentComment = null;
    let replyToUserId = null;
    if (req.body.parentComment) {
      const parent = await Comment.findOne({ _id: req.body.parentComment, issue: req.params.issueId });
      if (!parent) return res.status(404).json({ success: false, message: 'Comment being replied to was not found' });
      // Keep threads a single level deep — a reply always attaches to the
      // original top-level comment, never to another reply. `replyToUserId`
      // is kept separate from that flattening: it's whoever's comment was
      // actually clicked "Reply" on, even if that's a nested reply itself.
      parentComment = parent.parentComment || parent._id;
      replyToUserId = parent.user;
    }
    let comment = await Comment.create({
      issue: req.params.issueId,
      user: req.user._id,
      text: req.body.text,
      parentComment
    });
    comment = await comment.populate('user', 'name role avatar');
    await activity.log(req.params.issueId, req.user._id, 'comment', 'Added a comment');
    if (String(issue.reporter) !== String(req.user._id)) {
      await notify(issue.reporter, {
        title: 'New comment on your issue',
        message: `${req.user.name} commented on "${issue.title}": "${req.body.text}"`,
        link: `/issues/${issue._id}`,
        image: issue.attachments?.[0]?.url
      });
    }
    // Separate from the reporter notification above — replying to someone
    // else's comment should tell THEM, not just whoever reported the issue.
    // Guarded against double-notifying the reporter (already handled above)
    // and against notifying yourself when replying to your own comment.
    if (replyToUserId && String(replyToUserId) !== String(req.user._id) && String(replyToUserId) !== String(issue.reporter)) {
      await notify(replyToUserId, {
        title: 'Someone replied to your comment',
        message: `${req.user.name} replied to your comment on "${issue.title}": "${req.body.text}"`,
        link: `/issues/${issue._id}`,
        image: issue.attachments?.[0]?.url
      });
    }
    res.status(201).json({ success: true, comment });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/comments/:issueId/:commentId
exports.remove = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (String(comment.user) !== String(req.user._id) && !isStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!comment.parentComment) await Comment.deleteMany({ parentComment: comment._id });
    await comment.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
