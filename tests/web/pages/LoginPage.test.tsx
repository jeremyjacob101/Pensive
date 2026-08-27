// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "../../../Codebase - Pensive Web/src/context/useAuth";
import { LoginPage } from "../../../Codebase - Pensive Web/src/pages/LoginPage";
import type { AuthContextValue } from "../../../Codebase - Pensive Web/src/types/auth";

function renderLogin(
  signInPassword: AuthContextValue["signInPassword"],
  initialEntries: Parameters<typeof MemoryRouter>[0]["initialEntries"] = [
    "/login",
  ],
) {
  return render(
    <AuthContext.Provider
      value={{
        status: "unauthenticated",
        isAuthenticated: false,
        signInPassword,
        signOut: async () => undefined,
      }}
    >
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/expenses" element={<p>Expenses</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("LoginPage", () => {
  it("submits sign-in credentials and navigates to the requested destination", async () => {
    const signInPassword = vi.fn().mockResolvedValue(undefined);
    renderLogin(signInPassword, [
      {
        pathname: "/login",
        state: { from: { pathname: "/expenses", search: "?month=2025-01" } },
      },
    ]);
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await vi.waitFor(() =>
      expect(signInPassword).toHaveBeenCalledWith({
        username: "Alice",
        password: "secret-password",
        flow: "signIn",
      }));
    expect(await screen.findByText("Expenses")).toBeInTheDocument();
  });

  it("only exposes sign-in and displays authentication errors", async () => {
    const signInPassword = vi
      .fn()
      .mockRejectedValue(new Error("Invalid credentials"));
    renderLogin(signInPassword);
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Need an account? Sign up" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create Account" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Username"), {
      target: { value: "existing-user" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(signInPassword).toHaveBeenCalledWith({
      username: "existing-user",
      password: "bad",
      flow: "signIn",
    });
  });
});
