const router = require('express').Router();
const controller = require('../controllers/activityController');
const { identify } = require('../middleware/auth');
const requireVisibleIssue = require('../middleware/issueVisibility');

// The timeline names who moderated a post, when, and what they decided —
// staff names and roles included. It was served to anyone who asked, for any
// issue id, including posts held back from the public feed. Same visibility
// rule as the issue itself now applies (see middleware/issueVisibility.js).
router.get('/:issueId', identify, requireVisibleIssue, controller.timeline);

module.exports = router;
