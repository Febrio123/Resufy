/**
 * Toolbox validations (zod).
 * paraphraseSchema: input teks langsung (JSON) — string wajib, di-trim;
 * batasan panjang: 50–100.000 karakter (pesan Indonesia persis kontrak UI).
 */
const { z } = require('zod');

const paraphraseSchema = z.object({
  text: z
    .string('Teks wajib diisi')
    .trim()
    .min(50, 'Teks terlalu pendek.')
    .max(100000, 'Teks terlalu panjang.'),
});

module.exports = { paraphraseSchema };
