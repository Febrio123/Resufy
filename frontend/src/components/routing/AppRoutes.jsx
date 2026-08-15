import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import GuestOnly from "./GuestOnly";
import { PageLoader } from "../ui/Skeleton";
import { AuthLayout } from "../layouts/AuthLayout";
import { AppLayout } from "../layouts/AppLayout";

// Lazy: halaman berat (editor CV, hasil plagiarisme) tidak dibundel di first paint
const Landing = lazy(() => import("../../pages/Landing"));
const NotFound = lazy(() => import("../../pages/NotFound"));
const LoginPage = lazy(() => import("../../pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("../../pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(
	() => import("../../pages/auth/ForgotPasswordPage"),
);
const ResetPasswordPage = lazy(
	() => import("../../pages/auth/ResetPasswordPage"),
);
const DashboardPage = lazy(() => import("../../pages/app/DashboardPage"));
const CvListPage = lazy(() => import("../../pages/app/cvs/CvListPage"));
const CvNewPage = lazy(() => import("../../pages/app/cvs/CvNewPage"));
const CvEditPage = lazy(() => import("../../pages/app/cvs/CvEditPage"));
const CvDetailPage = lazy(() => import("../../pages/app/cvs/CvDetailPage"));
const PlagiarismNewPage = lazy(
	() => import("../../pages/app/plagiarism/PlagiarismNewPage"),
);
const PlagiarismResultPage = lazy(
	() => import("../../pages/app/plagiarism/PlagiarismResultPage"),
);
const ToolboxPage = lazy(() => import("../../pages/app/toolbox/ToolboxPage"));
const ToolDetailPage = lazy(
	() => import("../../pages/app/toolbox/ToolDetailPage"),
);
const AccountPage = lazy(() => import("../../pages/app/AccountPage"));

/**
 * AppRoutes — peta route final (06-frontend-react.md §Struktur Folder & Routing).
 * Toolbox sengaja PUBLIC (di luar RequireAuth) sesuai requirement B.6 —
 * tetap dirender di dalam AppLayout (konsisten, anonymous-friendly).
 * /login & /register di-guard GuestOnly (sesi valid → /app); forgot/reset
 * password TIDAK di-guard — reset dari email harus tetap jalan walau ada sesi.
 */
export default function AppRoutes() {
	const withSuspense = element => (
		<Suspense fallback={<PageLoader />}>{element}</Suspense>
	);

	return (
		<Routes>
			<Route
				path="/"
				element={withSuspense(<Landing />)}
			/>

			{/* Auth */}
			<Route element={<AuthLayout />}>
				{/* GuestOnly: user dengan sesi valid diarahkan ke /app (bukan form login) */}
				<Route element={<GuestOnly />}>
					<Route
						path="/login"
						element={withSuspense(<LoginPage />)}
					/>
					<Route
						path="/register"
						element={withSuspense(<RegisterPage />)}
					/>
				</Route>
				{/* forgot/reset sengaja TANPA GuestOnly — akses dari email harus tetap
				    berfungsi walau user punya sesi aktif di tab lain */}
				<Route
					path="/forgot-password"
					element={withSuspense(<ForgotPasswordPage />)}
				/>
				<Route
					path="/reset-password"
					element={withSuspense(<ResetPasswordPage />)}
				/>
			</Route>

			{/* Toolbox — PUBLIC, tetap di dalam AppLayout (konsisten, anonymous-friendly) */}
			<Route element={<AppLayout />}>
				<Route
					path="/app/toolbox"
					element={withSuspense(<ToolboxPage />)}
				/>
				<Route
					path="/app/toolbox/:tool"
					element={withSuspense(<ToolDetailPage />)}
				/>
			</Route>

			{/* Aplikasi terautentikasi */}
			<Route element={<RequireAuth />}>
				<Route element={<AppLayout />}>
					<Route
						path="/app"
						element={withSuspense(<DashboardPage />)}
					/>
					<Route
						path="/app/cvs"
						element={withSuspense(<CvListPage />)}
					/>
					<Route
						path="/app/cvs/new"
						element={withSuspense(<CvNewPage />)}
					/>
					<Route
						path="/app/cvs/:id/edit"
						element={withSuspense(<CvEditPage />)}
					/>
					<Route
						path="/app/cvs/:id"
						element={withSuspense(<CvDetailPage />)}
					/>
					<Route
						path="/app/plagiarism"
						element={withSuspense(<PlagiarismNewPage />)}
					/>
					<Route
						path="/app/plagiarism/:id"
						element={withSuspense(<PlagiarismResultPage />)}
					/>
					<Route
						path="/app/account"
						element={withSuspense(<AccountPage />)}
					/>
				</Route>
			</Route>

			<Route
				path="*"
				element={withSuspense(<NotFound />)}
			/>
		</Routes>
	);
}
