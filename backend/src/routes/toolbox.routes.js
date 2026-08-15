/** Toolbox routes — /api/toolbox. GRATIS, login OPSIONAL (untuk audit log). */
const router = require('express').Router();
const { optionalAuth } = require('../middlewares/auth');
const { strictLimits } = require('../middlewares/rateLimiter');
const { validate } = require('../middlewares/validate');
const { uploadToolbox } = require('../utils/multer');
const { paraphraseSchema } = require('../validations/toolbox.validation');
const ctrl = require('../controllers/toolbox.controller');

router.post('/compress', strictLimits.toolbox, optionalAuth, uploadToolbox.single('file'), ctrl.compress);
// Parafrase AI — input TEKS langsung (JSON {text}, 50–100k karakter). Tanpa file,
// tanpa multer: body di-parse express.json (global app.js). Zod → 422 bila invalid.
router.post('/paraphrase', strictLimits.toolbox, optionalAuth, validate(paraphraseSchema), ctrl.paraphrase);
// AI Content Detector — field file OPSIONAL (bisa JSON {text}); multer tidak
// error bila request bukan multipart (req.file = undefined).
router.post('/ai-check', strictLimits.toolbox, optionalAuth, uploadToolbox.single('file'), ctrl.aiCheck);

module.exports = router;
