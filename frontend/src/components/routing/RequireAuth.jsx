import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PageLoader } from '../ui/Skeleton';

/**
 * RequireAuth — guard route: selama booting auth tampilkan loader, lalu
 * redirect ke /login dengan state.next (agar kembali setelah login).
 * Sesuai 05-security.md §7: redirect 401 global + state preservation.
 *
 * SEO (09-seo.md): halaman ber-akun (/app, /app/cvs, /app/plagiarism, /app/account)
 * bersifat privat per pengguna → tambahkan <meta name="robots" content="noindex,
 * nofollow"> saat guard aktif. Sinyal pertama: robots.txt (Disallow /app);
 * sinyal kedua ini untuk crawler yang menjalankan JS. Toolbox (/app/toolbox*)
 * TIDAK lewat guard ini — tetap boleh di-index.
 */
export default function RequireAuth() {
  const { loading, user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  if (loading) return <PageLoader label="Menyiapkan sesi…" />;
  if (!user) return <Navigate to="/login" replace state={{ next: location }} />;

  return <Outlet />;
}
