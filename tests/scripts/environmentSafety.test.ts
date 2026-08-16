import { assertNonProductionEnvironment, assertNonProductionUrl, uniqueTestUsername } from "../support/environmentSafety";
import { describe, expect, it } from "vitest";

describe("test environment safety", () => {
  it("accepts development and staging URLs", () => {
    expect(
      assertNonProductionUrl("https://mellow-pigeon-433.convex.cloud").hostname,
    ).toBe("mellow-pigeon-433.convex.cloud");
    expect(() =>
      assertNonProductionUrl(
        "https://frugal-mosquito-712.convex.cloud",
      )).toThrow(/production/i);
  });

  it("rejects production values in test environment variables", () => {
    expect(() =>
      assertNonProductionEnvironment({ PENSIVE_ENV: "staging" })).not.toThrow();
    expect(() =>
      assertNonProductionEnvironment({
        CONVEX_URL: "https://frugal-mosquito-712.convex.cloud",
      })).toThrow(/production/i);
  });

  it("creates bounded unique usernames", () => {
    const first = uniqueTestUsername();
    const second = uniqueTestUsername();
    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(32);
    expect(first).toMatch(/^[a-z0-9-]+$/);
  });
});