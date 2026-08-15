import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';
import { authApi } from '../../services/auth';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { extractErrorMessage } from '../../utils/errors';
import { validateResetPassword } from '../../utils/validators';
import usePageMeta from '../../hooks/usePageMeta';

export default function ResetPasswordPage() {
  const toast = useToast();
  const reduced = useReducedMotion();
  // SEO fase 09: halaman ini memuat token rahasia di query string —
  // noindex, nofollow (robots meta dihapus otomatis saat navigasi keluar).
  usePageMeta({
    title: 'Atur Ulang Kata Sandi — resufy',
    description: 'Buat kata sandi baru untuk akun resufy kamu.',
    robots: 'noindex, nofollow',
  });
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const animProps = reduced
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: 'easeOut' } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateResetPassword(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password: form.password });
      setDone(true);
      toast.success('Kata sandi berhasil diubah. Silakan masuk.');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <motion.div {...animProps} className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle size={28} weight="bold" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold text-foreground">Kata sandi diperbarui</h1>
        <p className="text-sm text-muted-fg">Sekarang masuk dengan kata sandi barumu.</p>
        <Link to="/login">
          <Button variant="primary">Masuk Sekarang</Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div {...animProps}>
      <h1 className="text-2xl font-extrabold text-foreground">Buat Kata Sandi Baru</h1>
      <p className="mt-1 text-sm text-muted-fg">Minimal 8 karakter, kombinasi huruf dan angka.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Kata Sandi Baru"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          required
        />
        <Input
          label="Ulangi Kata Sandi Baru"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
          required
        />
        <Button type="submit" variant="primary" className="w-full" loading={submitting}>
          Simpan Kata Sandi
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-fg">
        <Link to="/login" className="font-bold text-primary hover:underline">
          Kembali ke masuk
        </Link>
      </p>
    </motion.div>
  );
}
