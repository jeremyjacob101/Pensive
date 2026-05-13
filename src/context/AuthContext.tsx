import type { AuthContextValue, AuthStatus } from "../types/auth";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMemo, type ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  const status: AuthStatus = isLoading
    ? "loading"
    : isAuthenticated
      ? "authenticated"
      : "unauthenticated";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated,
      async signInPassword(input) {
        await signIn("password", {
          flow: input.flow,
          email: input.email.trim().toLowerCase(),
          password: input.password,
        });
      },
      async signOut() {
        await signOut();
      },
    }),
    [isAuthenticated, signIn, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}