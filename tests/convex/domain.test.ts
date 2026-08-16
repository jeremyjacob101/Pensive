import { monthFromDate, normalizeMonthYearsInput } from "../../convex/monthYears";
import { normalizeEffectiveAmountFields } from "../../convex/paybackHelpers";
import { normalizeLegacyBaseSubId } from "../../convex/baseSubIds";
import { describe, expect, it } from "vitest";

describe("Convex domain helpers", () => {
  it.each([
    ["2025-01-15", "2025-01"],
    ["1/5/2025", "2025-01"],
    ["bad", ""],
  ])("extracts month from %s", (date, expected) => {
    expect(monthFromDate(date)).toBe(expected);
  });

  it("normalizes valid month years and falls back to the date", () => {
    expect(
      normalizeMonthYearsInput(
        [" 2025-02", "2025-01", "2025-02", "2025-13"],
        "2025-03-10",
      ),
    ).toEqual(["2025-01", "2025-02"]);
    expect(normalizeMonthYearsInput([], "1/5/2025")).toEqual(["2025-01"]);
    expect(() => normalizeMonthYearsInput([], "bad")).toThrow(
      "At least one valid month is required",
    );
  });

  it("normalizes legacy base/sub IDs", () => {
    expect(normalizeLegacyBaseSubId(" group-2 ", "fallback")).toEqual({
      legacyId: "group-002",
      baseId: "group",
      subId: "002",
    });
    expect(normalizeLegacyBaseSubId("", "fallback")).toEqual({
      legacyId: "fallback-000",
      baseId: "fallback",
      subId: "000",
    });
  });

  it("keeps manual effective amounts and derives automatic ones", () => {
    expect(
      normalizeEffectiveAmountFields({
        amount: 100,
        effectiveAmount: 80,
        effectiveAmountMode: "manual",
      }),
    ).toEqual({ effectiveAmount: 80, effectiveAmountMode: "manual" });
    expect(
      normalizeEffectiveAmountFields({ amount: 100, effectiveAmount: 80 }),
    ).toEqual({ effectiveAmount: 100, effectiveAmountMode: "auto" });
  });
});