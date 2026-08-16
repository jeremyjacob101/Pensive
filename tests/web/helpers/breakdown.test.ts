// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { maxMonth, minMonth, parseDateState } from "@pensive/web/helpers/breakdown";

describe("breakdown date state", () => {
  it("accepts a valid custom range", () => {
    expect(
      parseDateState(
        JSON.stringify({
          mode: "custom",
          activeMonth: "2025-04",
          customStart: "2025-01-01",
          customEnd: "2025-04-30",
        }),
      ),
    ).toEqual({
      mode: "custom",
      activeMonth: "2025-04",
      customRange: { startDate: "2025-01-01", endDate: "2025-04-30" },
    });
  });

  it("falls back safely for invalid persisted state", () => {
    expect(parseDateState("not json")).toEqual({
      mode: "month",
      activeMonth: null,
      customRange: null,
    });
    expect(
      parseDateState(JSON.stringify({ mode: "custom", customStart: "bad" })),
    ).toMatchObject({ mode: "month", customRange: null });
  });

  it("handles nullable month extrema", () => {
    expect(maxMonth(null, "2025-02")).toBe("2025-02");
    expect(maxMonth("2025-02", "2025-01")).toBe("2025-02");
    expect(minMonth(null, "2025-02")).toBe("2025-02");
    expect(minMonth("2025-02", "2025-01")).toBe("2025-01");
  });
});
