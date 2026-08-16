// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getDefaultOptionValue, getOptionColor, getScopedOptionColor, getScopedOptionValues, toOptionValues } from "@pensive/web/helpers/options";

const options = {
  category: [
    { value: "Food", color: "#111111", isDefault: true },
    { value: "Travel", color: "#222222" },
  ],
  subcategory: [
    { value: "Groceries", parentValue: "Food", color: "#333333" },
    { value: "Restaurants", parentValue: "Food", color: "#444444" },
    { value: "Flights", parentValue: "Travel", color: "#555555" },
  ],
};

describe("option helpers", () => {
  it("maps option records to values and handles missing lists", () => {
    expect(toOptionValues(options.category)).toEqual(["Food", "Travel"]);
    expect(toOptionValues(undefined)).toEqual([]);
  });

  it("resolves colors and defaults with fallbacks", () => {
    expect(getOptionColor(options, "category", "Food")).toBe("#111111");
    expect(getOptionColor(options, "category", "Missing")).toBe("#6B7280");
    expect(getOptionColor(options, "category", "")).toBe("#6B7280");
    expect(getDefaultOptionValue(options, "category")).toBe("Food");
    expect(getDefaultOptionValue(undefined, "category")).toBe("");
  });

  it("resolves subtype colors within their parent scope", () => {
    expect(
      getScopedOptionColor(options, "subcategory", "Groceries", "Food"),
    ).toBe("#333333");
    expect(
      getScopedOptionColor(options, "subcategory", "Groceries", "Travel"),
    ).toBe("#333333");
    expect(getScopedOptionValues(options, "subcategory", "Food")).toEqual([
      "Groceries",
      "Restaurants",
    ]);
  });
});
