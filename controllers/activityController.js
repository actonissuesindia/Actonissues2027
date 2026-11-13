const Activity = require('../models/Activity');

// Reusable logger used by other controllers.
exports.log = async (issue, user, action, details = '') => {
  return Activity.create({ issue, user, action, details });
};

// GET /api/activity/:issueId
exports.timeline = async (req, res, next) => {
  try {
    const activities = await Activity.find({ issue: req.params.issueId })
      .populate('user', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, activities });
  } catch (err) {
    next(err);
  }
};
