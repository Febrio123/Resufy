import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { EnvelopeSimple, LockKey, ShieldCheck, User } from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { extractErrorMessage } from '../../utils/errors';
import { validateRegister } from '../../utils/validators';
import usePageMeta from '../../hooks/usePageMeta';

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  // SEO fase 09
  usePageMeta({
    title: 'Buat Akun — resufy',
    description:
      'Daftar gratis di resufy — buat CV yang lolos ATS, cek plagiarisme, dan pakai toolbox dokumen tanpa biaya.',
  });

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateRegister(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      toast.success('Akun berhasil dibuat. Selamat datang di resufy!');
      navigate('/app', { replace: true });
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
      <h1 className="text-2xl font-extrabold text-foreground">Buat Akun</h1>
      <p className="mt-1 text-sm text-muted-fg">Gratis, tanpa kartu kredit. Siap dalam 1 menit.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Nama Lengkap"
          autoComplete="name"
          placeholder="Contoh: Rina Maharani"
          icon={User}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
        />
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
          autoComplete="new-password"
          placeholder="••••••••"
          icon={LockKey}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          hint="Minimal 8 karakter dengan kombinasi huruf dan angka."
          required
        />
        <Input
          label="Ulangi Kata Sandi"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          icon={LockKey}
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" variant="accent" className="w-full" loading={submitting}>
          Daftar Gratis
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-fg">
        <ShieldCheck size={14} weight="bold" className="text-success" aria-hidden />
        <span>Data terenkripsi · Pay-per-print Rp2.000, tanpa langganan</span>
      </div>

      <p className="mt-6 text-center text-sm text-muted-fg">
        Sudah punya akun?{' '}
        <Link to="/login" className="font-bold text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </motion.div>
  );
}
