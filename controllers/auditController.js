const AuditLog = require('../models/AuditLog');

// GET /api/admin/audit
exports.list = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate('user', 'name role')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
};

// Reusable audit logger used by other controllers/middleware.
exports.log = async (data) => {
  return AuditLog.create(data);
};
