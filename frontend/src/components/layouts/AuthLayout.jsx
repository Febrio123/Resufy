import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  CheckCircle,
  FileText,
  Key,
  LockKey,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react';

const TRUST_POINTS = [
  { icon: FileText, text: 'CV satu kolom yang benar-benar lolos saringan ATS' },
  { icon: CheckCircle, text: 'Cek plagiarisme dengan daftar sumber yang bisa diverifikasi' },
  { icon: ShieldCheck, text: 'Bayar hanya Rp2.000 saat unduh PDF HQ — tanpa langganan' },
];

const DEFAULT_QUOTE =
  'Buat CV standar rekruter, cek keaslian tulisan, lalu unduh PDF berkualitas tinggi hanya Rp2.000 — sekali bayar, tanpa langganan.';

/** Quote panel kiri per halaman auth (fallback default untuk /login). */
const QUOTES = {
  '/register':
    'Gratis selama membuat, mengedit, dan mengecek. Bayar hanya saat mengunduh PDF final — Rp2.000, sekali, untuk selamanya.',
  '/forgot-password':
    'Kami kirim tautan reset ke emailmu — aman, cepat, tanpa ribet. Kembalikan akses akunmu dalam beberapa menit.',
  '/reset-password':
    'Atur kata sandi baru untuk akunmu — minimal 8 karakter dengan kombinasi huruf dan angka.',
};

/** Badge kecil di atas form card per halaman auth. */
const BADGES = {
  '/register': { icon: Sparkle, text: 'Daftar gratis · tanpa kartu kredit' },
  '/forgot-password': { icon: Key, text: 'Reset kata sandi via email' },
  '/reset-password': { icon: LockKey, text: 'Buat kata sandi baru' },
};
const DEFAULT_BADGE = { icon: ShieldCheck, text: 'Masuk dengan aman' };

/**
 * AuthLayout — split-screen: kiri panel brand (gradient + grid pattern +
 * mini mockup skor), kanan form card premium. Quote & badge dinamis
 * berdasarkan pathname (nested-route via Outlet).
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

        <div className="relative flex items-center gap-2" aria-hidden>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Sparkle size={20} weight="bold" />
          </span>
          <span className="text-xl font-extrabold tracking-tight">resufy</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight">
            CV yang lolos ATS & laporan plagiarisme — dalam satu tempat.
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
            © {new Date().getFullYear()} resufy · Dibuat untuk pelamar kerja Indonesia
          </p>
        </div>
      </aside>

      {/* Panel kanan — form card premium */}
      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
        <div className="blob absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 bg-primary/10" aria-hidden />

        <Link
          to="/"
          className="relative mb-6 flex items-center gap-2 lg:hidden"
          aria-label="resufy — beranda"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary">
            <Sparkle size={18} weight="bold" aria-hidden />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-foreground">resufy</span>
        </Link>

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
            © {new Date().getFullYear()} resufy · Pay-per-print Rp2.000
          </p>
        </div>
      </main>
    </div>
  );
}
