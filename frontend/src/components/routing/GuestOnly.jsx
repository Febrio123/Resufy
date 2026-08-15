import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PageLoader } from '../ui/Skeleton';

/**
 * GuestOnly — kebalikan RequireAuth: guard untuk halaman yang HANYA boleh
 * diakses user BELUM login (/login, /register).
 * - loading (boot AuthContext) → PageLoader.
 * - user (sesi valid) → redirect ke /app (jangan suguhkan form login).
 * - tanpa sesi → render Outlet (form login/register).
 * forgot/reset password TIDAK memakai guard ini — user yang reset password
 * dari email tetap harus bisa mengakses walau punya sesi aktif di tab lain.
 */
export default function GuestOnly() {
  const { loading, user } = useAuth();

  if (loading) return <PageLoader label="Menyiapkan sesi…" />;
  if (user) return <Navigate to="/app" replace />;

  return <Outlet />;
}
