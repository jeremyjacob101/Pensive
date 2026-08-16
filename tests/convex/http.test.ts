import { asUser, createUser, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("Convex HTTP routes", () => {
  it("returns the session envelope and maps unauthenticated protected reads", async () => {
    const t = makeConvexTest();

    const session = await t.fetch("/api/auth/session");
    expect(session.status).toBe(200);
    expect(await json(session)).toEqual({
      ok: true,
      data: { authenticated: false },
    });

    for (const path of [
      "/api/expenses/month-bounds",
      "/api/incomings/month-bounds",
      "/api/tracking/list",
      "/api/notepad/get-mine",
      "/api/user-options/list",
      "/api/payback-links/list-incoming-candidates",
    ]) {
      const response = await t.fetch(path);
      expect(response.status, path).toBe(401);
      expect(await json(response), path).toMatchObject({
        ok: false,
        error: { code: "unauthorized" },
      });
    }
  });

  it("validates auth payloads without creating a user", async () => {
    const t = makeConvexTest();
    const headers = { "content-type": "application/json" };

    const signIn = await t.fetch("/api/auth/sign-in", {
      method: "POST",
      headers,
      body: JSON.stringify({ username: "", password: "" }),
    });
    expect(signIn.status).toBe(422);
    expect(await json(signIn)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });

    const invalidSignUp = await t.fetch("/api/auth/sign-up", {
      method: "POST",
      headers,
      body: JSON.stringify({ username: "x", password: "password" }),
    });
    expect(invalidSignUp.status).toBe(422);
    expect(await json(invalidSignUp)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });

    const refresh = await t.fetch("/api/auth/refresh", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(refresh.status).toBe(422);
    expect(await json(refresh)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  it("wraps an authenticated query result in the stable success envelope", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "http-user");
    const client = asUser(t, user);
    const response = await client.fetch("/api/auth/session");

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: { authenticated: true, userId: user },
    });

    const bounds = await client.fetch("/api/expenses/month-bounds");
    expect(bounds.status).toBe(200);
    expect(await json(bounds)).toMatchObject({
      ok: true,
      data: { newestMonth: null, oldestMonth: null },
    });

    await client.query(testApi.expenses.monthBounds, {});
  });

  it("treats malformed JSON bodies as empty input and still returns a safe error envelope", async () => {
    const t = makeConvexTest();
    const response = await t.fetch("/api/summaries/range", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
  });
});