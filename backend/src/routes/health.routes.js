/** Health routes — /api/health */
const router = require('express').Router();
const ctrl = require('../controllers/health.controller');

router.get('/', ctrl.health);

module.exports = router;
