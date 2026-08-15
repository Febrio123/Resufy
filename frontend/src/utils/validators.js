/** Validasi form ringan (error inline di bawah field). */

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!String(email || '').trim()) errors.email = 'Email wajib diisi';
  else if (!isEmail(email)) errors.email = 'Format email tidak valid';
  if (!String(password || '')) errors.password = 'Password wajib diisi';
  return errors;
}

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!String(name || '').trim()) errors.name = 'Nama wajib diisi';
  if (!String(email || '').trim()) errors.email = 'Email wajib diisi';
  else if (!isEmail(email)) errors.email = 'Format email tidak valid';
  if (!String(password || '')) errors.password = 'Password wajib diisi';
  else if (String(password).length < 8) errors.password = 'Minimal 8 karakter';
  if (String(confirmPassword || '') !== String(password || ''))
    errors.confirmPassword = 'Konfirmasi password tidak cocok';
  return errors;
}

export function validateResetPassword({ password, confirmPassword }) {
  const errors = {};
  if (!String(password || '')) errors.password = 'Password baru wajib diisi';
  else if (String(password).length < 8) errors.password = 'Minimal 8 karakter';
  if (String(confirmPassword || '') !== String(password || ''))
    errors.confirmPassword = 'Konfirmasi password tidak cocok';
  return errors;
}

export function validateForgotPassword({ email }) {
  const errors = {};
  if (!String(email || '').trim()) errors.email = 'Email wajib diisi';
  else if (!isEmail(email)) errors.email = 'Format email tidak valid';
  return errors;
}

export function validateCvTitle(title) {
  const value = String(title || '').trim();
  if (!value) return 'Judul wajib diisi';
  if (value.length > 120) return 'Maksimal 120 karakter';
  return '';
}
