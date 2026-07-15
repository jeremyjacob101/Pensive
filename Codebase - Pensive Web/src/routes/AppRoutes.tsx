import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { getRedirectTarget } from "../helpers/authRedirect";
import { useAuth } from "../context/useAuth";
import { lazy, Suspense } from "react";

const AppLayout = lazy(() =>
  import("../pages/AppLayout").then(({ AppLayout }) => ({
    default: AppLayout,
  })));
const Breakdown = lazy(() =>
  import("../pages/Breakdown").then(({ Breakdown }) => ({
    default: Breakdown,
  })));
const Expenses = lazy(() =>
  import("../pages/Expenses").then(({ Expenses }) => ({
    default: Expenses,
  })));
const Incomings = lazy(() =>
  import("../pages/Incomings").then(({ Incomings }) => ({
    default: Incomings,
  })));
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then(({ LoginPage }) => ({
    default: LoginPage,
  })));
const Notepad = lazy(() =>
  import("../pages/Notepad").then(({ Notepad }) => ({
    default: Notepad,
  })));
const Options = lazy(() =>
  import("../pages/Options").then(({ Options }) => ({
    default: Options,
  })));
const Recurrings = lazy(() =>
  import("../pages/Recurrings").then(({ Recurrings }) => ({
    default: Recurrings,
  })));
const Tracking = lazy(() =>
  import("../pages/Tracking").then(({ Tracking }) => ({
    default: Tracking,
  })));

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/expenses" replace />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/incomings" element={<Incomings />} />
            <Route path="/breakdown" element={<Breakdown />} />
            <Route path="/recurrings" element={<Recurrings />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/notepad" element={<Notepad />} />
            <Route path="/options" element={<Options />} />
          </Route>
          <Route path="/app/*" element={<LegacyAppPathRedirect />} />
        </Route>

        <Route path="*" element={<RootFallback />} />
      </Routes>
    </Suspense>
  );
}

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <RouteLoadingScreen />;
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <RouteLoadingScreen />;
  }

  if (status === "authenticated") {
    const from = getRedirectTarget(location.state);
    return <Navigate to={from || "/expenses"} replace />;
  }

  return <Outlet />;
}

export function RootFallback() {
  const { isAuthenticated, status } = useAuth();
  if (status === "loading") {
    return <RouteLoadingScreen />;
  }
  return <Navigate to={isAuthenticated ? "/expenses" : "/login"} replace />;
}

function LegacyAppPathRedirect() {
  const location = useLocation();
  const redirectedPath = location.pathname.replace(/^\/app/, "") || "/";
  return <Navigate to={redirectedPath} replace />;
}

function RouteLoadingScreen() {
  return (
    <main className="page loading-screen" aria-live="polite">
      Loading...
    </main>
  );
}