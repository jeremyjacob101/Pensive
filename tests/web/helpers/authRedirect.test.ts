// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getRedirectTarget } from "@pensive/web/helpers/authRedirect";

describe("auth redirect targets", () => {
  it("preserves a safe internal path, query, and hash", () => {
    expect(
      getRedirectTarget({
        from: { pathname: "/expenses", search: "?month=2025-01", hash: "#row" },
      }),
    ).toBe("/expenses?month=2025-01#row");
  });

  it.each([
    [null, null],
    [{ from: { pathname: "https://evil.example" } }, null],
    [{ from: { pathname: "/login" } }, null],
    [{ from: { pathname: 42 } }, null],
  ])("rejects unsafe redirect state %j", (state, expected) => {
    expect(getRedirectTarget(state)).toBe(expected);
  });
});
