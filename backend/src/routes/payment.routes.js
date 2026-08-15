/**
 * Payment routes — /api/payments
 * Catatan urutan penting: /webhook DILETAKKAN PALING ATAS supaya tidak tertelan
 * oleh /:id (Express match berurutan). Webhook TANPA auth & TANPA CSRF —
 * keamanannya = verifikasi signature sha512 internal (paymentService) + cek
 * konsistensi gross_amount. Dikecualikan dari rate limiter ketat (Midtrans
 * perlu akses bebas saat notifikasi berulang).
 * SEMUA route lain: requireAuth → csrfProtect (state-changing) → limit.
 */
const router = require('express').Router();
const { validate } = require('../middlewares/validate');
const { requireAuth } = require('../middlewares/auth');
const { csrfProtect } = require('../middlewares/csrf');
const { strictLimits } = require('../middlewares/rateLimiter');
const ctrl = require('../controllers/payment.controller');
const { createPaymentSchema } = require('../validations/payment.validation');

router.post('/webhook', ctrl.webhook);

router.use(requireAuth, csrfProtect);

router.post('/', strictLimits.paymentCreate, validate(createPaymentSchema), ctrl.createPayment);
router.get('/', ctrl.listPayments);
router.get('/:id/status', ctrl.getPaymentStatus);
router.get('/:id', ctrl.getPayment);

module.exports = router;
