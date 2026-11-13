const router = require('express').Router();
const c = require('../controllers/heroQuoteController');

router.get('/', c.list);

module.exports = router;
