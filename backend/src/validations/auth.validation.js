/** Zod schemas — auth endpoints. Error mapping 422 di middleware validate. */
const z = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid').max(255),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
});

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema };
