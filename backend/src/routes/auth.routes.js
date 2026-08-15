/** Auth routes — /api/auth */
const router = require('express').Router();
const { validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { strictLimits } = require('../middlewares/rateLimiter');
const ctrl = require('../controllers/auth.controller');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validations/auth.validation');

router.post('/register', strictLimits.auth, validate(registerSchema), ctrl.register);
router.post('/login', strictLimits.auth, validate(loginSchema), ctrl.login);
router.post('/refresh', strictLimits.refresh, ctrl.refreshSession);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
// CSRF token (double-submit) — dipakai frontend utk header X-CSRF-Token.
// Publik (tanpa auth): token acak per sesi cookie, aman diterbitkan kapan saja.
router.get('/csrf', ctrl.getCsrf);
router.post('/forgot-password', strictLimits.forgotPassword, validate(forgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', strictLimits.forgotPassword, validate(resetPasswordSchema), ctrl.resetPassword);

module.exports = router;
