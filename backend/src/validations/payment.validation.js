/** Zod schemas — payment endpoints. */
const z = require('zod');

const createPaymentSchema = z.object({
  itemType: z.enum(['cv', 'plagiarism'], { errorMap: () => ({ message: 'itemType harus "cv" atau "plagiarism"' }) }),
  itemId: z.string().min(1, 'itemId wajib diisi'),
});

module.exports = { createPaymentSchema };
