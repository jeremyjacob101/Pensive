// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getMonthsBetween, monthInTrailingBuffer, parseBufferByRow, parseStartByRow, shiftMonth, trackingOptionKey } from "@pensive/web/helpers/tracking";

describe("tracking helpers", () => {
  it("creates stable row keys and shifts months", () => {
    expect(trackingOptionKey("subcategory", "Groceries", "Food")).toBe(
      "subcategory|Groceries|Food",
    );
    expect(shiftMonth("2024-12", 1)).toBe("2025-01");
    expect(getMonthsBetween("2025-01", "2025-03")).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
    ]);
  });

  it("parses and clamps persisted row settings", () => {
    expect(parseStartByRow('{"a":" 2025-02 ","b":"bad","c":3}')).toEqual({
      a: "2025-02",
    });
    expect(parseBufferByRow('{"a":-2,"b":99,"c":"3","d":"bad"}')).toEqual({
      a: 0,
      b: 12,
      c: 3,
    });
  });

  it("checks trailing month buffers", () => {
    expect(monthInTrailingBuffer("2025-02", "2025-04", 3)).toBe(true);
    expect(monthInTrailingBuffer("2025-01", "2025-04", 3)).toBe(false);
    expect(monthInTrailingBuffer("2025-04", "2025-04", 0)).toBe(false);
  });
});
