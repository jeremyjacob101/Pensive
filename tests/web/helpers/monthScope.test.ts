// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fallbackCurrentMonthWindow, monthFromWindow, validIsoDate, validMonth, windowFromMonth } from "@pensive/web/helpers/monthScope";

describe("month scope helpers", () => {
  it("validates month and ISO-date shapes", () => {
    expect(validMonth("2025-01")).toBe(true);
    expect(validMonth("2025-1")).toBe(false);
    expect(validIsoDate("2025-01-02")).toBe(true);
    expect(validIsoDate("2025-1-2")).toBe(false);
  });

  it("builds a calendar window and extracts its month", () => {
    const window = windowFromMonth("2024-02");
    expect(window).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(monthFromWindow(window)).toBe("2024-02");
  });

  it("always returns a valid current-month fallback window", () => {
    const window = fallbackCurrentMonthWindow();
    expect(validIsoDate(window.startDate)).toBe(true);
    expect(validIsoDate(window.endDate)).toBe(true);
    expect(window.startDate.slice(0, 7)).toBe(window.endDate.slice(0, 7));
  });
});
