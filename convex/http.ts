import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/api/auth/session",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const data = identity
      ? { authenticated: true, userId: identity.subject }
      : { authenticated: false };

    return jsonOk(data);
  }),
});

http.route({
  path: "/api/auth/sign-in",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = (body.password ?? "").trim();

    if (!email || !password) {
      return jsonError(422, "validation", "Enter both email and password.");
    }

    const result = (await ctx.runAction(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email,
        password,
      },
    })) as {
      tokens?: { token?: string; refreshToken?: string } | null;
    };

    if (!result?.tokens?.token) {
      return jsonError(401, "unauthorized", "Email or password is incorrect.");
    }

    const data = {
      authenticated: true,
      token: result.tokens.token,
      refreshToken: result.tokens.refreshToken ?? null,
      userId: email,
    };

    return jsonOk(data);
  }),
});

http.route({
  path: "/api/auth/sign-out",
  method: "POST",
  handler: httpAction(async (ctx) => {
    await ctx.runAction(api.auth.signOut, {});
    return jsonOk({});
  }),
});

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default http;
