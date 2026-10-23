import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, PlusCircle, SignOut, Sparkle, SquaresFour, User } from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../ui/Logo';

const NAV_ITEMS = [
  {
    to: '/app',
    label: 'Dashboard',
    icon: SquaresFour,
    end: true,
  },
  {
    to: '/app/cvs',
    label: 'CV Saya',
    icon: FileText,
    end: false,
  },
  {
    to: '/app/cvs/new',
    label: 'Buat CV Baru',
    icon: PlusCircle,
    end: false,
  },
  {
    to: '/app/account',
    label: 'Pengaturan Akun',
    icon: User,
    end: false,
  },
];

/**
 * AppLayout — Shell aplikasi CV Maker ATS.
 * Fokus 100% pada pembuatan & pengelolaan CV standar ATS.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const isAuthed = Boolean(user);

  const sidebarFooter = (
    <div className="border-t border-border p-3">
      {isAuthed ? (
        <button
          type="button"
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-fg transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted transition-colors group-hover:bg-destructive/10">
            <SignOut size={16} aria-hidden />
          </span>
          Keluar
        </button>
      ) : (
        <NavLink
          to="/login"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-50"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-100">
            <SignOut size={16} aria-hidden />
          </span>
          Masuk Akun
        </NavLink>
      )}
    </div>
  );

  const userRow = (
    <div className="flex items-center gap-3 border-b border-border/70 bg-gradient-to-r from-primary-50/60 to-transparent p-4">
      <Avatar name={user?.name || 'U'} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">
          {user?.name || 'Pengguna'}
        </p>
        <p className="truncate text-xs text-muted-fg">
          {user?.email || ''}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5 border-b border-border">
          <Logo to="/app" size="md" showTagline />
        </div>
        {userRow}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigasi aplikasi">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-50 to-primary-100/60 text-primary shadow-sm'
                    : 'text-muted-fg hover:bg-muted/70 hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute -left-3 h-6 w-1 rounded-r-full bg-cta-gradient"
                      aria-hidden
                    />
                  )}
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-cta-gradient text-white shadow-glow-primary'
                        : 'bg-muted text-muted-fg group-hover:bg-white group-hover:shadow-sm'
                    }`}
                  >
                    <item.icon size={18} weight={isActive ? 'bold' : 'regular'} aria-hidden />
                  </span>
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {sidebarFooter}
      </aside>

      {/* Konten */}
      <div className="flex min-h-dvh w-full flex-col lg:pl-64">
        {/* Mobile top header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-white/85 px-4 backdrop-blur-md lg:hidden">
          <Logo to="/app" size="sm" />
          <NavLink
            to="/app/account"
            aria-label="Akun saya"
            className="grid h-11 w-11 place-items-center rounded-lg text-muted-fg hover:bg-muted"
          >
            <Avatar name={user?.name || 'U'} size="sm" />
          </NavLink>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 lg:py-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 text-xs text-muted-fg md:px-6 lg:pb-8 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/40">
          <span>© {new Date().getFullYear()} HireUp · Generator CV ATS Standar</span>
          <span className="text-primary font-medium">Template dengan Foto (Pojok Kiri Atas) & Tanpa Foto</span>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Navigasi bawah"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-white/90 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-fg hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      className="absolute top-1.5 h-1 w-10 rounded-full bg-cta-gradient"
                      aria-hidden
                    />
                  )}
                  <span
                    className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${
                      isActive ? 'bg-primary-50' : ''
                    }`}
                  >
                    <item.icon size={20} weight={isActive ? 'bold' : 'regular'} aria-hidden />
                  </span>
                  <span className="truncate px-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export { NAV_ITEMS };
