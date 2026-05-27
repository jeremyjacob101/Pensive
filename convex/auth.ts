import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

function normalizeUsernameCandidate(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  const atIndex = trimmed.indexOf("@");
  return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const username =
          typeof params.username === "string"
            ? normalizeUsernameCandidate(params.username)
            : typeof params.email === "string"
              ? normalizeUsernameCandidate(params.email)
              : "";

        if (!username) {
          throw new Error("Missing `username`");
        }

        return { email: username, username };
      },
    }),
  ],
});