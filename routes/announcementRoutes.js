const router = require('express').Router();
const c = require('../controllers/announcementController');

router.get('/', c.list);

module.exports = router;
