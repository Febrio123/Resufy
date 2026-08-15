/** CV routes — /api/cvs (semua butuh login; ownership dicek di controller) */
const router = require('express').Router();
const { validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { csrfProtect } = require('../middlewares/csrf');
const ctrl = require('../controllers/cv.controller');
const { createCvSchema, updateCvSchema, atsJobSchema, previewCvSchema } = require('../validations/cv.validation');

router.use(requireAuth, csrfProtect); // auth dulu (401), lalu CSRF utk POST/PUT/DELETE

router.post('/', validate(createCvSchema), ctrl.createCv);
// §35: preview PDF stateless (sebelum simpan; tidak menyentuh DB) — wajib
// SEBELUM route `/:id` dgn metode berbeda supaya tidak tertangkap param.
router.post('/preview-pdf', validate(previewCvSchema), ctrl.previewPdf);
router.get('/', ctrl.listCvs);
router.get('/:id', ctrl.getCv);
router.put('/:id', validate(updateCvSchema), ctrl.updateCv);
router.delete('/:id', ctrl.deleteCv);
router.post('/:id/duplicate', ctrl.duplicateCv);

// ATS score — GRATIS. GET (tanpa body) & POST (opsional jobDescription utk keyword match)
router.get('/:id/ats-score', ctrl.getAtsScore);
router.post('/:id/ats-score', validate(atsJobSchema), ctrl.getAtsScore);

// PDF: preview (watermark) & final (paid). GET & POST dipetakan ke handler sama
// (keputusan backend: mendukung kontrak UI §7.1 yang pakai GET, dan versi POST).
router.get('/:id/preview-pdf', ctrl.getPreviewPdf);
router.post('/:id/preview-pdf', ctrl.getPreviewPdf);
router.get('/:id/final-pdf', ctrl.getFinalPdf);
router.post('/:id/final-pdf', ctrl.getFinalPdf);

module.exports = router;
