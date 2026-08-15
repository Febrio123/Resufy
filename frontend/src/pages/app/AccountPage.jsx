import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, EnvelopeSimple, Key, SignOut, User } from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../utils/format';

/**
 * AccountPage — READ-ONLY. Backend MVP tidak menyediakan /api/users/me
 * (update profil) maupun change-password; yang tersedia hanya info dari
 * /api/auth/me. Ganti kata sandi diarahkan ke halaman lupa kata sandi.
 */
export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app')}
            aria-label="Kembali ke dashboard"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted"
          >
            <CaretLeft size={20} aria-hidden />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Akun Saya</h1>
            <p className="text-sm text-muted-fg">Data akun & sesi kamu.</p>
          </div>
        </div>

        <Card className="flex items-center gap-4 p-5">
          <Avatar name={user?.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-foreground">{user?.name}</p>
            <p className="truncate text-sm text-muted-fg">{user?.email}</p>
          </div>
        </Card>

        <Card padded={false} className="p-0">
          <ul className="divide-y divide-border">
            <li className="flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-100 text-primary">
                <User size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Nama</p>
                <p className="truncate text-sm font-bold text-foreground">{user?.name}</p>
              </div>
            </li>
            <li className="flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-100 text-primary">
                <EnvelopeSimple size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Email</p>
                <p className="truncate text-sm font-bold text-foreground">{user?.email}</p>
              </div>
            </li>
            <li className="flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-100 text-primary">
                <Key size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-fg">Kata Sandi</p>
                <p className="text-sm text-muted-fg">Ganti kata sandi via tautan email (sementara).</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/forgot-password')}>
                Reset
              </Button>
            </li>
            <li className="flex items-center gap-3 p-4">
              <Badge tone="lunas">Member Gratis</Badge>
              <p className="text-xs text-muted-fg">
                Bergabung {user?.createdAt ? formatDate(user.createdAt) : '—'} · pay-per-print, tanpa
                langganan.
              </p>
            </li>
          </ul>
        </Card>

        <Button variant="danger" icon={SignOut} className="w-full" onClick={() => setConfirmLogout(true)}>
          Keluar dari Akun
        </Button>

        <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} size="sm" labelledBy="logout-title" title="Keluar?">
          <div className="space-y-4">
            <p className="text-sm text-muted-fg">
              Kamu akan keluar dari sesi ini. Dokumen tetap tersimpan di akunmu.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmLogout(false)}>
                Batal
              </Button>
              <Button variant="danger" onClick={handleLogout} loading={loggingOut}>
                Keluar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
  );
}
