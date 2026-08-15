/** Plagiarism routes — /api/plagiarism (login wajib; proses async → polling) */
const router = require('express').Router();
const { requireAuth } = require('../middlewares/auth');
const { csrfProtect } = require('../middlewares/csrf');
const { strictLimits, plagiarismPerUser } = require('../middlewares/rateLimiter');
const { upload } = require('../utils/multer');
const ctrl = require('../controllers/plagiarism.controller');

router.use(requireAuth, csrfProtect); // auth dulu (401), lalu CSRF utk POST

// Upload: rate limit IP (5/menit) + rate limit PER-USER (5/jam — biaya SerpApi)
router.post('/upload', strictLimits.upload, plagiarismPerUser, upload.single('file'), ctrl.uploadPlagiarism);
router.get('/', ctrl.listChecks);
router.get('/:id', ctrl.getCheck);

// PDF (GET & POST sama — lihat catatan di cv.routes.js)
router.get('/:id/preview-pdf', ctrl.getPreviewPdf);
router.post('/:id/preview-pdf', ctrl.getPreviewPdf);
router.get('/:id/final-pdf', ctrl.getFinalPdf);
router.post('/:id/final-pdf', ctrl.getFinalPdf);

module.exports = router;
