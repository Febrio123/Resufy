import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import GuestOnly from './GuestOnly';
import { PageLoader } from '../ui/Skeleton';
import { AuthLayout } from '../layouts/AuthLayout';
import { AppLayout } from '../layouts/AppLayout';

// Lazy: halaman CV & Auth
const Landing = lazy(() => import('../../pages/Landing'));
const NotFound = lazy(() => import('../../pages/NotFound'));
const LoginPage = lazy(() => import('../../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../../pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('../../pages/app/DashboardPage'));
const CvListPage = lazy(() => import('../../pages/app/cvs/CvListPage'));
const CvNewPage = lazy(() => import('../../pages/app/cvs/CvNewPage'));
const CvEditPage = lazy(() => import('../../pages/app/cvs/CvEditPage'));
const CvDetailPage = lazy(() => import('../../pages/app/cvs/CvDetailPage'));
const AccountPage = lazy(() => import('../../pages/app/AccountPage'));

/**
 * AppRoutes — Fokus 100% pada Pembuatan CV Standar ATS.
 * Fitur plagiarisme dan toolbox telah dihapus sesuai instruksi user.
 */
export default function AppRoutes() {
  const withSuspense = (element) => (
    <Suspense fallback={<PageLoader />}>{element}</Suspense>
  );

  return (
    <Routes>
      <Route path="/" element={withSuspense(<Landing />)} />

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={withSuspense(<LoginPage />)} />
          <Route path="/register" element={withSuspense(<RegisterPage />)} />
        </Route>
        <Route path="/forgot-password" element={withSuspense(<ForgotPasswordPage />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPasswordPage />)} />
      </Route>

      {/* Aplikasi CV ATS (Terautentikasi) */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={withSuspense(<DashboardPage />)} />
          <Route path="/app/cvs" element={withSuspense(<CvListPage />)} />
          <Route path="/app/cvs/new" element={withSuspense(<CvNewPage />)} />
          <Route path="/app/cvs/:id/edit" element={withSuspense(<CvEditPage />)} />
          <Route path="/app/cvs/:id" element={withSuspense(<CvDetailPage />)} />
          <Route path="/app/account" element={withSuspense(<AccountPage />)} />
        </Route>
      </Route>

      <Route path="*" element={withSuspense(<NotFound />)} />
    </Routes>
  );
}
