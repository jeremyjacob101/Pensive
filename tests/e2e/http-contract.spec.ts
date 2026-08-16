import { expect, test } from "playwright/test";

const apiURL = process.env.PENSIVE_E2E_API_URL!;

function apiPath(path: string) {
  return `${apiURL}${path}`;
}

test.describe("non-production HTTP contract", () => {
  test("returns an unauthenticated session envelope", async ({ request }) => {
    const response = await request.get(apiPath("/api/auth/session"));

    expect(response.status()).toBe(200);
    await expect(response).toBeOK();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { authenticated: false },
    });
  });

  test("rejects protected reads without credentials", async ({ request }) => {
    const response = await request.get(apiPath("/api/expenses/month-bounds"));
    const payload = await response.json();

    expect(response.status()).toBe(401);
    expect(payload).toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });

  test("validates malformed authentication requests without creating data", async ({
    request,
  }) => {
    const signIn = await request.post(apiPath("/api/auth/sign-in"), {
      data: { username: "", password: "" },
    });
    expect(signIn.status()).toBe(422);
    await expect(signIn.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "validation" },
    });

    const signUp = await request.post(apiPath("/api/auth/sign-up"), {
      data: { username: "", password: "" },
    });
    expect(signUp.status()).toBe(422);
    await expect(signUp.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "validation" },
    });
  });

  test("does not expose production URLs in test responses", async ({
    request,
  }) => {
    const response = await request.get(apiPath("/api/auth/session"));
    const body = await response.text();
    expect(body).not.toMatch(/frugal-mosquito-712|production/i);
  });
});