const router = require('express').Router();
const c = require('../controllers/commentController');
const { isAuthenticated, identify } = require('../middleware/auth');
const requireVisibleIssue = require('../middleware/issueVisibility');

// identify() attaches req.user when there's a session but doesn't demand one —
// the thread on an approved post stays readable by anonymous visitors, exactly
// as before, while requireVisibleIssue keeps the thread on a post that's still
// awaiting review (or was rejected) to its author and staff. Without that gate
// this route answered for any issue id at all.
router.get('/:issueId', identify, requireVisibleIssue, c.list);
router.post('/:issueId', isAuthenticated, requireVisibleIssue, c.add);
router.delete('/:issueId/:commentId', isAuthenticated, requireVisibleIssue, c.remove);

module.exports = router;
