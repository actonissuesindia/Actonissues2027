const Issue = require('../models/Issue');
const User = require('../models/User');

// GET /api/admin/reports  -> aggregate summary for the admin dashboard.
exports.dashboard = async (req, res, next) => {
  try {
    const [totalIssues, openIssues, inProgress, resolvedIssues, pendingReview, users, byCategory, self] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: 'Open' }),
      Issue.countDocuments({ status: 'In Progress' }),
      Issue.countDocuments({ status: 'Resolved' }),
      Issue.countDocuments({ moderationStatus: 'Pending' }),
      User.countDocuments(),
      Issue.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      // Looked up fresh (not trusted from the session) so a grant/revoke by
      // the owner takes effect on this account's very next page load,
      // rather than only after their session refreshes.
      User.findById(req.user._id).select('canCreateCitizens')
    ]);
    res.json({
      success: true,
      summary: { totalIssues, openIssues, inProgress, resolvedIssues, pendingReview, users, canCreateCitizens: !!self?.canCreateCitizens },
      byCategory
    });
  } catch (err) {
    next(err);
  }
};
