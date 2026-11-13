const maintenance = require('../services/maintenanceService');
const { log: auditLog } = require('./auditController');

// The browser end of the one-off data fixes. Super Admin only — these change
// live data across every account, which is not something an Admin-tier staff
// member should reach by clicking around.
//
// Authorisation is enforced on the route (authorize('Admin')); this file's job
// is to make sure nothing runs without a preview having been possible first,
// and that every run leaves a trace.

// GET /api/admin/maintenance
exports.list = async (req, res, next) => {
  try {
    res.json({ success: true, jobs: maintenance.list() });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/maintenance/:id/preview — reads only.
exports.preview = async (req, res, next) => {
  try {
    const report = await maintenance.preview(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'No such maintenance job' });
    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/maintenance/:id/run
exports.run = async (req, res, next) => {
  try {
    const job = maintenance.JOBS.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'No such maintenance job' });

    // A destructive job needs the confirmation the screen collects, checked
    // here rather than only in the browser — the browser is not where a
    // safeguard belongs.
    if (job.danger && req.body?.confirm !== job.id) {
      return res.status(400).json({
        success: false,
        message: 'This job deletes data. Confirm it by name before it will run.'
      });
    }

    const report = await maintenance.apply(req.params.id);

    await auditLog({
      user: req.user._id,
      action: 'maintenance_run',
      entity: 'System',
      entityId: job.id,
      ip: req.ip,
      details: `${job.name} — ${report.summary}`
    });

    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
};
