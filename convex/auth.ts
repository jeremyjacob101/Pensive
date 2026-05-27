import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const username =
          typeof params.username === "string"
            ? params.username.trim().toLowerCase()
            : typeof params.email === "string"
              ? params.email.trim().toLowerCase()
              : "";

        if (!username) {
          throw new Error("Missing `username`");
        }

        return { email: username, username };
      },
    }),
  ],
});