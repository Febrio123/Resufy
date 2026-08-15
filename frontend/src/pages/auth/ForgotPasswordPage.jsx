import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { authApi } from '../../services/auth';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { extractErrorMessage } from '../../utils/errors';
import { validateForgotPassword } from '../../utils/validators';
import usePageMeta from '../../hooks/usePageMeta';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const reduced = useReducedMotion();
  // SEO fase 09
  usePageMeta({
    title: 'Lupa Kata Sandi — resufy',
    description: 'Atur ulang kata sandi akun resufy kamu melalui email.',
  });
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const animProps = reduced
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: 'easeOut' } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateForgotPassword({ email });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <motion.div {...animProps} className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-100 text-primary">
          <PaperPlaneTilt size={28} weight="bold" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold text-foreground">Cek email kamu</h1>
        <p className="text-sm text-muted-fg">
          Jika email <span className="font-bold text-foreground">{email}</span> terdaftar, kami
          sudah mengirim tautan reset kata sandi. Tautan berlaku sementara.
        </p>
        <Link to="/login" className="text-sm font-bold text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div {...animProps}>
      <h1 className="text-2xl font-extrabold text-foreground">Lupa Kata Sandi?</h1>
      <p className="mt-1 text-sm text-muted-fg">
        Masukkan email akunmu — kami kirim tautan untuk membuat kata sandi baru.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Button type="submit" variant="primary" className="w-full" loading={submitting}>
          Kirim Tautan Reset
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-fg">
        Ingat kata sandi?{' '}
        <Link to="/login" className="font-bold text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </motion.div>
  );
}
