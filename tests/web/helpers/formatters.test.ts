// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatMoney, getDisplayEffectiveAmount, getEffectiveAmount, getMonthSpanCount, getProportionalEffectiveDisplay, toAmount } from "@pensive/web/helpers/formatters";

describe("formatters and amount helpers", () => {
  it.each([
    ["₪1,234.50", 1234.5],
    ["  42.10 ", 42.1],
    ["", 0],
    ["not a number", 0],
    ["-$5.50", -5.5],
  ])("parses %s as %s", (value, expected) => {
    expect(toAmount(value)).toBe(expected);
  });

  it("formats money with a shekel sign and two decimals", () => {
    expect(formatMoney(1234.5)).toBe("₪1,234.50");
    expect(formatMoney(-2)).toBe("₪-2.00");
  });

  it("uses the explicit effective amount when present", () => {
    expect(getEffectiveAmount({ amount: 100, effectiveAmount: 80 })).toBe(80);
    expect(getEffectiveAmount({ amount: 100 })).toBe(100);
  });

  it("splits a multi-month effective amount for display", () => {
    const row = {
      amount: 100,
      effectiveAmount: 90,
      monthYears: ["2025-01", "2025-02"],
    };
    expect(getMonthSpanCount(row)).toBe(2);
    expect(getDisplayEffectiveAmount(row)).toBe(45);
    expect(getProportionalEffectiveDisplay(row, ["2025-02"])).toEqual({
      totalRowMonths: 2,
      matchingSelectedMonths: 1,
      displayAmount: 45,
      totalEffectiveAmount: 90,
      isPartial: true,
    });
  });

  it("treats rows without month years as one month", () => {
    expect(getMonthSpanCount({})).toBe(1);
    expect(
      getProportionalEffectiveDisplay({ amount: 20 }, ["2025-01"]),
    ).toMatchObject({
      totalRowMonths: 1,
      matchingSelectedMonths: 1,
      displayAmount: 20,
      isPartial: false,
    });
  });
});
