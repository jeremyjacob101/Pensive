import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { getRedirectTarget } from "../helpers/authRedirect";
import { Recurrings } from "../pages/Recurrings";
import { AppLayout } from "../pages/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { Incomings } from "../pages/Incomings";
import { Breakdown } from "../pages/Breakdown";
import { useAuth } from "../context/useAuth";
import { Expenses } from "../pages/Expenses";
import { Options } from "../pages/Options";

export function AppRoutes() {
  return (
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
          <Route path="/options" element={<Options />} />
        </Route>
        <Route path="/app/*" element={<LegacyAppPathRedirect />} />
      </Route>

      <Route path="*" element={<RootFallback />} />
    </Routes>
  );
}

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <main className="page loading-screen">Loading...</main>;
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
    return <main className="page loading-screen">Loading...</main>;
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
    return <main className="page loading-screen">Loading...</main>;
  }
  return <Navigate to={isAuthenticated ? "/expenses" : "/login"} replace />;
}

function LegacyAppPathRedirect() {
  const location = useLocation();
  const redirectedPath = location.pathname.replace(/^\/app/, "") || "/";
  return <Navigate to={redirectedPath} replace />;
}