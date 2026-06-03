import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

const dayMs = 1000 * 60 * 60 * 24;
const inactiveSessionMs = dayMs * 30 * 5;
const totalSessionMs = dayMs * 365;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  session: {
    totalDurationMs: totalSessionMs,
    inactiveDurationMs: inactiveSessionMs,
  },
  providers: [
    Password({
      profile: (params) => {
        const username = String(params.email ?? "").trim().toLowerCase();
        return {
          email: username,
          username,
        };
      },
    }),
  ],
});
