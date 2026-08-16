// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatOrdinalDay, getMonthFromIsoDate, getMonthsBetween, getMonthsInRange, isEndOfMonth, isStartOfMonth, normalizeMonthYears, parseMonthYears, shiftMonth, toggleMonthYearSelection } from "@pensive/web/helpers/dates";

describe("date and month helpers", () => {
  it.each([
    ["2024-01", 1, "2024-02"],
    ["2024-12", 1, "2025-01"],
    ["2024-01", -1, "2023-12"],
  ])("shifts %s by %s to %s", (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected);
  });

  it("leaves malformed months unchanged", () => {
    expect(shiftMonth("not-a-month", 1)).toBe("not-a-month");
  });

  it("normalizes, filters, deduplicates, and sorts month years", () => {
    expect(
      normalizeMonthYears([" 2024-03 ", "2024-01", "2024-03", "2024-13"]),
    ).toEqual(["2024-01", "2024-03"]);
  });

  it("falls back to the date month when persisted month years are absent", () => {
    expect(parseMonthYears("[]", "2025-07-18")).toEqual(["2025-07"]);
    expect(parseMonthYears("not json", "2025-07-18")).toEqual(["2025-07"]);
  });

  it("rejects non-array persisted month years", () => {
    expect(parseMonthYears('{"month":"2025-07"}', "2025-08-18")).toEqual([]);
  });

  it("returns inclusive month ranges across years", () => {
    expect(getMonthsBetween("2024-11", "2025-02")).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
    expect(getMonthsInRange("2024-11-30", "2025-02-01")).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
  });

  it("handles month selection at edges and in gaps", () => {
    expect(toggleMonthYearSelection([], "2025-02")).toEqual(["2025-02"]);
    expect(toggleMonthYearSelection(["2025-02"], "2025-04")).toEqual([
      "2025-02",
      "2025-03",
      "2025-04",
    ]);
    expect(toggleMonthYearSelection(["2025-02", "2025-04"], "2025-03")).toEqual(
      ["2025-02", "2025-03", "2025-04"],
    );
    expect(toggleMonthYearSelection(["2025-02", "2025-03"], "2025-02")).toEqual(
      ["2025-03"],
    );
  });

  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
  ])("formats ordinal day %s", (day, expected) => {
    expect(formatOrdinalDay(day)).toBe(expected);
  });

  it("identifies month boundaries and ISO month values", () => {
    expect(isStartOfMonth("2024-02-01")).toBe(true);
    expect(isEndOfMonth("2024-02-29")).toBe(true);
    expect(isEndOfMonth("2023-02-28")).toBe(true);
    expect(isStartOfMonth("invalid")).toBe(false);
    expect(getMonthFromIsoDate("2024-02-29")).toBe("2024-02");
    expect(getMonthFromIsoDate("2024-2-29")).toBe("");
  });
});
