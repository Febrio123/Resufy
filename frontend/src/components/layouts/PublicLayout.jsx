import { Link } from 'react-router-dom';
import { LockKey, ShieldCheck, Sparkle } from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';

const FOOTER_COLUMNS = [
  {
    title: 'Produk',
    links: [
      { label: 'CV ATS-Ready', to: '/' },
      { label: 'Cek Plagiarisme', to: '/' },
      { label: 'Toolbox Dokumen', to: '/app/toolbox' },
    ],
  },
];

// Kolom "Akun" footer — DINAMIS mengikuti status login (di-render di komponen).
const GUEST_ACCOUNT_LINKS = [
  { label: 'Masuk', to: '/login' },
  { label: 'Daftar Gratis', to: '/register' },
];
const AUTHED_ACCOUNT_LINKS = [{ label: 'Dashboard', to: '/app' }];

/**
 * PublicLayout — header navigasi halaman publik (Landing, Toolbox public, NotFound).
 * Mobile: brand + link; desktop: brand + nav tengah + CTA masuk.
 * Soft UI: header blur + logo mark gradient.
 * Navbar & footer kolom "Akun" DINAMIS mengikuti status login (useAuth):
 * loading → placeholder skeleton (anti kedip); user → tombol "Dashboard" +
 * nama depan (desktop); guest → "Masuk" + "Daftar Gratis".
 */
export function PublicLayout({ navItems = [], cta = null, children }) {
  const { user, loading } = useAuth();

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="group flex items-center gap-2" aria-label="resufy — beranda">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary transition-transform duration-200 group-hover:scale-105">
              <Sparkle size={18} weight="bold" aria-hidden />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-foreground">resufy</span>
          </Link>

          {navItems.length > 0 && (
            <nav aria-label="Navigasi utama" className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-fg transition-colors hover:bg-primary-50 hover:text-primary"
                >
                  {item.icon && <item.icon size={18} aria-hidden />}
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {loading ? (
              // Placeholder ringan saat boot — cegah kedip "Masuk/Daftar" lalu berubah.
              <span aria-hidden className="h-11 w-28 animate-pulse rounded-lg bg-surface" />
            ) : user ? (
              <>
                {firstName && (
                  <span className="hidden h-11 items-center text-sm font-semibold text-muted-fg sm:flex">
                    {firstName}
                  </span>
                )}
                <Link to="/app">
                  <Button variant="primary" size="sm">
                    Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden h-11 items-center rounded-lg px-4 text-sm font-semibold text-muted-fg hover:bg-primary-50 hover:text-primary sm:flex"
                >
                  Masuk
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Daftar Gratis
                  </Button>
                </Link>
              </>
            )}
            {cta}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        {children}
      </main>

      {/* Footer publik */}
      <footer className="border-t border-border bg-gradient-to-b from-surface to-primary-50/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
            {/* Brand */}
            <div>
              <Link to="/" className="flex items-center gap-2" aria-label="resufy — beranda">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary">
                  <Sparkle size={18} weight="bold" aria-hidden />
                </span>
                <span className="text-lg font-extrabold tracking-tight text-foreground">resufy</span>
              </Link>
              <p className="mt-3 max-w-xs text-sm text-muted-fg">
                CV yang lolos saringan ATS & laporan plagiarisme — untuk pelamar kerja Indonesia.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-muted-fg">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck size={14} weight="bold" className="text-success" aria-hidden />
                  Data terenkripsi & dokumen tersimpan aman di akunmu
                </li>
                <li className="flex items-center gap-1.5">
                  <LockKey size={14} weight="bold" className="text-primary" aria-hidden />
                  Bayar hanya saat mengunduh — tanpa langganan
                </li>
              </ul>
            </div>

            {/* Kolom link (statis) */}
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.title} aria-label={`Footer — ${col.title}`}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {col.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="text-sm text-muted-fg transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            {/* Kolom Akun — DINAMIS: "Dashboard" saat login, "Masuk/Daftar" saat guest */}
            <nav aria-label="Footer — Akun">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Akun</h2>
              <ul className="mt-4 space-y-2.5">
                {(user ? AUTHED_ACCOUNT_LINKS : GUEST_ACCOUNT_LINKS).map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-muted-fg transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Harga */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Harga</h2>
              <p className="mt-4 text-sm text-muted-fg">
                Buat, edit, dan cek —{' '}
                <span className="font-bold text-foreground">gratis</span>. Unduh PDF HQ cukup{' '}
                <span className="font-bold text-foreground">Rp2.000</span> sekali bayar, untuk
                selamanya.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent ring-1 ring-inset ring-accent/25">
                Pay-per-print · Tanpa langganan
              </span>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-fg">
              © {new Date().getFullYear()} resufy · Pay-per-print Rp2.000 · Tanpa langganan
            </p>
            <div className="flex items-center gap-4 text-xs">
              <a href="#" className="font-semibold text-muted-fg transition-colors hover:text-primary">
                Kebijakan Privasi
              </a>
              <a href="#" className="font-semibold text-muted-fg transition-colors hover:text-primary">
                Syarat Layanan
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
