import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/auth';
import { refreshSessionOnce, setCsrfToken, setSessionEndedHandler } from '../services/http';
import { isSessionReusedError } from '../utils/errors';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/** Delay kecil sebelum retry refresh race — biarkan tab pemenang menimpa cookie. */
const BOOT_RETRY_DELAY_MS = 400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Auth state + session (05-security.md §7):
 * - JWT TIDAK disimpan di localStorage — hanya httpOnly cookie.
 * - CSRF token disimpan di MEMORY (dari GET /api/auth/csrf atau body login/register).
 * - 401 non-auth → auto-refresh di interceptor http.js; refresh gagal →
 *   sessionEndedHandler (logout lokal + redirect /login).
 * - Boot: /auth/me 401 → POST /auth/refresh dengan RETRY SEKALI untuk race
 *   multi-tab: 2 tab boot bersamaan → tab kalah claim menerima 401 UNAUTHORIZED
 *   netral (sesi tetap hidup, cookie refresh baru sudah di-set tab pemenang di
 *   browser) → tunggu lalu coba lagi. SESSION_REUSED → sesi dicabut → tanpa retry.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  // Boot: ambil CSRF token + cek sesi (GET /api/auth/me). Kalau access token
  // sudah kedaluwarsa, coba refresh (maks 2×) sebelum menyimpulkan "belum login".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await authApi.getCsrf();
        if (!cancelled) setCsrfToken(data.csrfToken);
      } catch {
        /* CSRF endpoint publik — gagal = server belum hidup; biarkan boot lanjut */
      }
      try {
        const { data } = await authApi.me();
        if (!cancelled) setUser(data.user);
      } catch {
        let bootUser = null;
        let bootError = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            // Lewat refreshSessionOnce (singleton http.js) — satu jalur serial
            // untuk SEMUA refresh; bila interceptor/ensureFreshSession sedang
            // refresh, boot menunggu hasil yang sama (bukan rotasi ganda).
            const { data } = await refreshSessionOnce();
            bootUser = data.user;
            break;
          } catch (err) {
            bootError = err;
            if (isSessionReusedError(err)) break; // dicabut → tanpa retry
            if (err?.response?.status === 401 && attempt === 1) {
              await wait(BOOT_RETRY_DELAY_MS); // biarkan tab pemenang menimpa cookie
              if (cancelled) break;
              continue;
            }
            break; // non-401 (network/5xx) → tidak ada gunanya retry
          }
        }
        if (!cancelled && bootUser) {
          setUser(bootUser);
        } else if (!cancelled && isSessionReusedError(bootError)) {
          // Toast khusus: sesi dicabut karena alasan keamanan (tanpa redirect —
          // RequireAuth menangani halaman terproteksi; halaman publik tetap aman).
          toast.info('Sesi kamu dicabut karena alasan keamanan. Silakan masuk kembali.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Handler sesi berakhir — dipanggil interceptor saat refresh gagal (401 apa
  // pun termasuk SESSION_REUSED = seluruh keluarga sesi dicabut server).
  const handleSessionEnded = useCallback(
    (error) => {
      setUser(null);
      setCsrfToken(null);
      const code = error?.response?.data?.error?.code;
      const message =
        code === 'SESSION_REUSED'
          ? 'Sesi kamu dicabut karena alasan keamanan. Silakan masuk kembali.'
          : 'Sesi berakhir — silakan masuk kembali';
      toast.info(message);
      navigate('/login', {
        state: { next: window.location.pathname + window.location.search },
      });
    },
    [toast, navigate]
  );

  useEffect(() => {
    setSessionEndedHandler(handleSessionEnded);
    return () => setSessionEndedHandler(null);
  }, [handleSessionEnded]);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await authApi.login({ email, password });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const { data } = await authApi.register({ name, email, password });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* tetap logout lokal walau request gagal */
    }
    setUser(null);
    setCsrfToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setUser(data.user);
    } catch {
      /* tetap state lama */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
