const router = require('express').Router();
const c = require('../controllers/issueController');
const escalation = require('../controllers/escalationController');
const upload = require('../middleware/upload');
const { isAuthenticated, identify, authorizeStaff } = require('../middleware/auth');
const requireVisibleIssue = require('../middleware/issueVisibility');

// Public reads — identify() optionally attaches req.user (for mine=/moderation=all/owner checks)
// without requiring a session, so these routes stay open to anonymous visitors.
router.get('/', identify, c.list);
router.get('/meta', c.meta);
router.get('/stats', c.stats);
router.get('/category-counts', c.categoryCounts);
router.get('/top-reporters', c.topReporters);
router.get('/featured', identify, c.featured);
// Viewing a single issue's full detail requires a signed-in account —
// the feed list above stays open to anonymous visitors.
router.get('/:id', isAuthenticated, c.get);

// Authenticated writes.
//
// Photos ride along with the report itself rather than following in a second
// request, so a submission either succeeds whole or leaves nothing behind —
// the split version filed the issue first and uploaded afterwards, so a failed
// upload showed the reporter an error next to a report that had, in fact, been
// filed (see c.create). multer ignores a plain JSON body, so callers sending
// no files are unaffected.
router.post('/', isAuthenticated, upload.array('attachments', 6), c.create);
router.patch('/:id', isAuthenticated, c.update);
router.delete('/:id', isAuthenticated, c.remove);
router.post('/:id/support', isAuthenticated, c.toggleSupport);
router.post('/:id/disagree', isAuthenticated, c.toggleDisagree);

// Escalating to a real-world authority and previewing that email before it
// sends are staff-only, no owner-editable case to blend into c.update.
// Preview takes no files (see escalationController.previewEscalation) since
// anything picked in the browser isn't uploaded until the real send.
router.post('/:id/escalate', isAuthenticated, authorizeStaff(), upload.array('images', 6), escalation.escalate);
router.post('/:id/escalate/preview', isAuthenticated, authorizeStaff(), escalation.previewEscalation);
// Viewing the escalation thread is NOT staff-only — any signed-in user can
// see it (treated as public-within-the-app accountability info). But
// "public-within-the-app" has to mean the same thing here as everywhere else:
// the thread carries the authority's contact details and the full report, and
// it was readable for any issue id, including posts held back from the feed.
// requireVisibleIssue applies the post's own visibility to its thread.
router.get('/:id/escalations', isAuthenticated, requireVisibleIssue, escalation.listEscalations);

module.exports = router;
