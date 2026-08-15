import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { EnvelopeSimple, LockKey, ShieldCheck } from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { extractErrorMessage } from '../../utils/errors';
import { validateLogin } from '../../utils/validators';
import usePageMeta from '../../hooks/usePageMeta';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  // SEO fase 09
  usePageMeta({
    title: 'Masuk — resufy',
    description:
      'Masuk ke akun resufy untuk melanjutkan CV, cek plagiarisme, dan toolbox dokumen gratis.',
  });

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // `next` bisa berbentuk objek Location (dari RequireAuth) ATAU string path
  // (dari AuthContext.handleSessionEnded saat sesi kedaluwarsa) — tangani keduanya
  // agar setelah login kembali ke halaman asal, bukan selalu /app.
  const next = location.state?.next;
  const from = typeof next === 'string' ? next : next?.pathname || '/app';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateLogin(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await login(form);
      toast.success('Berhasil masuk. Selamat datang kembali!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <h1 className="text-2xl font-extrabold text-foreground">Masuk</h1>
      <p className="mt-1 text-sm text-muted-fg">Lanjutkan perjalanan lamarmu.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          icon={EnvelopeSimple}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          required
        />
        <Input
          label="Kata Sandi"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          icon={LockKey}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          required
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
            Lupa kata sandi?
          </Link>
        </div>

        <Button type="submit" variant="accent" className="w-full" loading={submitting}>
          Masuk
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-fg">
        <ShieldCheck size={14} weight="bold" className="text-success" aria-hidden />
        <span>Data terenkripsi · Bayar hanya saat unduh PDF HQ</span>
      </div>

      <p className="mt-6 text-center text-sm text-muted-fg">
        Belum punya akun?{' '}
        <Link to="/register" className="font-bold text-primary hover:underline">
          Daftar gratis
        </Link>
      </p>
    </motion.div>
  );
}
