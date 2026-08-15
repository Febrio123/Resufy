/** Barrel routes — mount semua resource di bawah /api */
const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/cvs', require('./cv.routes'));
router.use('/plagiarism', require('./plagiarism.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/toolbox', require('./toolbox.routes'));

module.exports = router;
