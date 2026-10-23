import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  CheckCircle,
  FileText,
  Key,
  LockKey,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react';

import { Logo } from '../ui/Logo';

const TRUST_POINTS = [
  { icon: FileText, text: 'CV standar ATS yang ramah scanner rekruter' },
  { icon: CheckCircle, text: '2 Template pilihan: dengan foto 3x4 formal atau tanpa foto' },
  { icon: ShieldCheck, text: 'Skor ATS realtime dan download PDF gratis' },
];

const DEFAULT_QUOTE =
  'Buat CV standar rekruter, optimasi dengan skor ATS realtime, dan cetak PDF profesional tanpa ribet.';

/** Quote panel kiri per halaman auth (fallback default untuk /login). */
const QUOTES = {
  '/register':
    'Daftar gratis dan buat CV ATS profesional dalam hitungan menit.',
  '/forgot-password':
    'Kami kirim tautan reset ke emailmu — aman, cepat, tanpa ribet. Kembalikan akses akunmu dalam beberapa menit.',
  '/reset-password':
    'Atur kata sandi baru untuk akunmu — minimal 8 karakter dengan kombinasi huruf dan angka.',
};

/** Badge kecil di atas form card per halaman auth. */
const BADGES = {
  '/register': { icon: Sparkle, text: 'Daftar gratis · HireUp' },
  '/forgot-password': { icon: Key, text: 'Reset kata sandi via email' },
  '/reset-password': { icon: LockKey, text: 'Buat kata sandi baru' },
};
const DEFAULT_BADGE = { icon: ShieldCheck, text: 'Masuk dengan aman' };

/**
 * AuthLayout — split-screen: kiri panel brand, kanan form card.
 */
export function AuthLayout() {
  const { pathname } = useLocation();
  const quote = QUOTES[pathname] || DEFAULT_QUOTE;
  const badge = BADGES[pathname] || DEFAULT_BADGE;

  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:flex-row">
      {/* Panel kiri — hanya desktop */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-panel-gradient p-10 text-white lg:flex">
        {/* Dekorasi: grid + blob */}
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="blob -left-20 -top-24 h-80 w-80 bg-primary-500/40" aria-hidden />
        <div className="blob bottom-10 right-0 h-72 w-72 bg-indigo-400/30" aria-hidden />
        <div
          className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl"
          aria-hidden
        />

        <div className="relative inline-flex items-center">
          <div className="rounded-xl bg-white px-3.5 py-1.5 shadow-md">
            <Logo to="/" size="md" />
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">
            Bangun CV Standar ATS Profesional bersama HireUp.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/75">{quote}</p>

          {/* Mini mockup skor ATS */}
          <div className="mt-8 max-w-sm rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">
                Skor ATS terbaru
              </p>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">
                LIVE
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative grid h-16 w-16 place-items-center">
                {/* Ring conic-gradient (zero SVG): nilai 94% putih, track putih/15 */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      'conic-gradient(rgb(255 255 255 / 0.92) 0% 94%, rgb(255 255 255 / 0.15) 94% 100%)',
                  }}
                  aria-hidden
                />
                <div className="absolute inset-[5px] rounded-full bg-white/10" aria-hidden />
                <span className="relative text-sm font-extrabold text-white">94</span>
              </div>
              <ul className="space-y-1.5 text-xs text-white/85">
                {['Kontak & ringkasan lengkap', 'Format satu kolom', 'Keyword relevan'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle size={13} weight="bold" className="text-emerald-400" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="relative">
          <ul className="space-y-2 text-sm text-white/80">
            {TRUST_POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <p.icon size={15} weight="bold" aria-hidden />
                </span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-white/50">
            © {new Date().getFullYear()} HireUp · Dibuat untuk pelamar kerja Indonesia
          </p>
        </div>
      </aside>

      {/* Panel kanan — form card premium */}
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
        <div className="blob absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 bg-primary/10" aria-hidden />

        <div className="relative mb-6 lg:hidden">
          <Logo to="/" size="md" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl ring-1 ring-black/5 md:p-8">
            {badge && (
              <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">
                <badge.icon size={14} weight="bold" aria-hidden />
                {badge.text}
              </span>
            )}
            <Outlet />
          </div>
          <p className="mt-6 text-center text-xs text-muted-fg">
            © {new Date().getFullYear()} HireUp · Pay-per-print Rp2.000
          </p>
        </div>
      </main>
    </div>
  );
}
