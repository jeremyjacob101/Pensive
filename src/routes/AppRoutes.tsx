import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppSectionPage } from "../pages/AppSectionPage";
import { AppLayout } from "../pages/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { useAuth } from "../context/useAuth";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="expenses" replace />} />
          <Route
            path="expenses"
            element={<AppSectionPage activeTab="expenses" />}
          />
          <Route
            path="incomings"
            element={<AppSectionPage activeTab="incomings" />}
          />
          <Route
            path="recurrings"
            element={<AppSectionPage activeTab="recurrings" />}
          />
          <Route
            path="options"
            element={<AppSectionPage activeTab="options" />}
          />
        </Route>
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
    return <Navigate to="/login" replace state={{ from: location }} />;
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
    const from = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname;
    return <Navigate to={from || "/app/expenses"} replace />;
  }

  return <Outlet />;
}

export function RootFallback() {
  const { isAuthenticated, status } = useAuth();
  if (status === "loading") {
    return <main className="page loading-screen">Loading...</main>;
  }
  return <Navigate to={isAuthenticated ? "/app/expenses" : "/login"} replace />;
}