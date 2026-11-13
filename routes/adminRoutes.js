const router = require('express').Router();
const { isAuthenticated, authorize, authorizeStaff } = require('../middleware/auth');
const users = require('../controllers/userAdminController');
const report = require('../controllers/reportController');
const audit = require('../controllers/auditController');
const settings = require('../controllers/settingsController');
const announcement = require('../controllers/announcementController');
const heroQuote = require('../controllers/heroQuoteController');
const pageBlocks = require('../controllers/pageBlockController');
const articles = require('../controllers/articleController');
const customPages = require('../controllers/customPageController');
const escalation = require('../controllers/escalationController');
const departments = require('../controllers/departmentContactController');
const issues = require('../controllers/issueController');
const maintenance = require('../controllers/maintenanceController');
const upload = require('../middleware/upload');

router.use(isAuthenticated);

// Authority can see and manage every account (Citizen/Authority/Admin) —
// the "full" role for user management. Admin's access is scoped down to
// Citizen accounts only: the users list, role assignment, status, delete,
// and password reset all restrict Admin to Citizen targets in the
// controller itself (not just hidden in the UI) — see userAdminController.
router.get('/reports', authorizeStaff(), report.dashboard);
router.get('/users', authorizeStaff(), users.users);
router.get('/roles', authorizeStaff(), users.roles);

router.post('/users', authorizeStaff(), users.createUser);
router.patch('/users/:id', authorizeStaff(), users.updateUser);

router.post('/users/email', authorizeStaff(), users.sendBulkEmail);
router.get('/users/email-log', authorizeStaff(), users.emailLog);
router.get('/escalations', authorizeStaff(), escalation.adminList);
router.post('/users/:id/reset-password', authorizeStaff(), users.resetPassword);
router.patch('/users/:id/status', authorizeStaff(), users.setStatus);
router.delete('/users/:id', authorizeStaff(), users.deleteUser);

// Site-wide announcement banner — either staff role can create/edit/delete.
// GET here returns every announcement regardless of schedule (unlike the
// public GET /api/announcements, which only returns currently-active ones).
router.get('/announcements', authorizeStaff(), announcement.adminList);
router.post('/announcements', authorizeStaff(), announcement.create);
router.patch('/announcements/:id', authorizeStaff(), announcement.update);
router.delete('/announcements/:id', authorizeStaff(), announcement.remove);

// Department contact directory — either staff role can maintain it, same
// tier as announcements (day-to-day escalation work, not a Super-Admin-only
// site setting). See models/DepartmentContact.js.
router.get('/departments', authorizeStaff(), departments.list);
router.get('/departments/lookup', authorizeStaff(), departments.lookupByIssue);
router.post('/departments/import', authorizeStaff(), upload.uploadSpreadsheet.single('file'), departments.importFromFile);
router.post('/departments', authorizeStaff(), departments.create);
router.patch('/departments/:id', authorizeStaff(), departments.update);
router.delete('/departments/:id', authorizeStaff(), departments.remove);

// Home hero headline quotes — Super Admin only (stored 'Admin'), unlike
// announcements which either staff tier can manage. See models/HeroQuote.js.
router.get('/hero-quotes', authorize('Admin'), heroQuote.list);
router.post('/hero-quotes', authorize('Admin'), heroQuote.create);
router.patch('/hero-quotes/:id', authorize('Admin'), heroQuote.update);
router.delete('/hero-quotes/:id', authorize('Admin'), heroQuote.remove);

// Admin-only: system settings and the audit trail.
router.get('/audit', authorize('Admin'), audit.list);

// One-off data fixes, runnable from the browser instead of a terminal.
// Super Admin only: these change live data across every account.
router.get('/maintenance', authorize('Admin'), maintenance.list);
router.get('/maintenance/:id/preview', authorize('Admin'), maintenance.preview);
router.post('/maintenance/:id/run', authorize('Admin'), maintenance.run);
router.get('/settings', authorize('Admin'), settings.index);
router.put('/settings', authorize('Admin'), settings.save);
router.post('/issues/backfill-translations', authorize('Admin'), issues.backfillTranslations);

// Page Builder — Super Admin only, same gate as hero-quotes/settings above
// (not authorizeStaff() — see models/PageBlock.js). The reorder route MUST
// come before the /:id route below, or Express would match "reorder" as an id.
router.get('/page-blocks', authorize('Admin'), pageBlocks.adminList);
router.post('/page-blocks/upload-image', authorize('Admin'), upload.uploadImage.single('image'), pageBlocks.uploadImage);
router.post('/page-blocks', authorize('Admin'), pageBlocks.create);
router.patch('/page-blocks/reorder', authorize('Admin'), pageBlocks.reorder);
router.patch('/page-blocks/:id', authorize('Admin'), pageBlocks.update);
router.delete('/page-blocks/:id', authorize('Admin'), pageBlocks.remove);

// Articles (SEO blog content) — Super Admin only, same tier as Page Builder
// (public site content, not day-to-day issue moderation). Reuses the same
// upload-image endpoint above for cover images — no separate upload route needed.
router.get('/articles', authorize('Admin'), articles.adminList);
router.post('/articles', authorize('Admin'), articles.create);
router.patch('/articles/:id', authorize('Admin'), articles.update);
router.delete('/articles/:id', authorize('Admin'), articles.remove);

// Custom pages — Super Admin creates a standalone, Page Builder-driven page
// (its own URL, built from blocks) without writing code. Same tier as
// Page Builder/Articles above. Content itself is edited via the existing
// /page-blocks endpoints (page: `custom-<this id>`), not here.
router.get('/pages', authorize('Admin'), customPages.adminList);
router.post('/pages', authorize('Admin'), customPages.create);
router.patch('/pages/:id', authorize('Admin'), customPages.update);
router.patch('/pages/:id/toggle-nav', authorize('Admin'), customPages.toggleNav);
router.delete('/pages/:id', authorize('Admin'), customPages.remove);

module.exports = router;
