// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AuthContext } from "../../../Codebase - Pensive Web/src/context/useAuth";
import { ProtectedRoute, PublicOnlyRoute, RootFallback } from "../../../Codebase - Pensive Web/src/routes/AppRoutes";
import type { AuthContextValue } from "../../../Codebase - Pensive Web/src/types/auth";

function authValue(status: AuthContextValue["status"]): AuthContextValue {
  return {
    status,
    isAuthenticated: status === "authenticated",
    signInPassword: async () => undefined,
    signOut: async () => undefined,
  };
}

function renderWithRoutes(
  element: ReactNode,
  status: AuthContextValue["status"],
  initialEntries: Parameters<typeof MemoryRouter>[0]["initialEntries"] = [
    "/private",
  ],
) {
  return render(
    <AuthContext.Provider value={authValue(status)}>
      <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("web route guards", () => {
  it("shows a loading state before auth resolves", () => {
    renderWithRoutes(<ProtectedRoute />, "loading");
    expect(screen.getByRole("main")).toHaveTextContent("Loading...");
  });

  it("redirects unauthenticated users to login and preserves the original location", () => {
    renderWithRoutes(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<p>Private</p>} />
        </Route>
        <Route path="/login" element={<p>Login</p>} />
      </Routes>,
      "unauthenticated",
      ["/private?filter=active#top"],
    );
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    renderWithRoutes(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<p>Private content</p>} />
        </Route>
      </Routes>,
      "authenticated",
    );
    expect(screen.getByText("Private content")).toBeInTheDocument();
  });

  it("redirects authenticated users away from login to a valid requested path", () => {
    renderWithRoutes(
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<p>Login</p>} />
        </Route>
        <Route path="/expenses" element={<p>Expenses</p>} />
      </Routes>,
      "authenticated",
      [
        {
          pathname: "/login",
          state: {
            from: {
              pathname: "/expenses",
              search: "?month=2025-01",
              hash: "#table",
            },
          },
        },
      ],
    );
    expect(screen.getByText("Expenses")).toBeInTheDocument();
  });

  it("uses the default route for malformed or absent redirects", () => {
    renderWithRoutes(
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<p>Login</p>} />
        </Route>
        <Route path="/expenses" element={<p>Expenses</p>} />
      </Routes>,
      "authenticated",
      [
        {
          pathname: "/login",
          state: { from: { pathname: "https://evil.invalid" } },
        },
      ],
    );
    expect(screen.getByText("Expenses")).toBeInTheDocument();
  });

  it("routes the root fallback according to authentication status", () => {
    const unauthenticated = renderWithRoutes(
      <Routes>
        <Route path="*" element={<RootFallback />} />
        <Route path="/login" element={<p>Login</p>} />
      </Routes>,
      "unauthenticated",
      ["/unknown"],
    );
    expect(screen.getByText("Login")).toBeInTheDocument();
    unauthenticated.unmount();

    renderWithRoutes(
      <Routes>
        <Route path="*" element={<RootFallback />} />
        <Route path="/expenses" element={<p>Expenses</p>} />
      </Routes>,
      "authenticated",
      ["/unknown"],
    );
    expect(screen.getByText("Expenses")).toBeInTheDocument();
  });
});
