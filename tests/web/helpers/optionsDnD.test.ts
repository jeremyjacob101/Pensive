// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { kindFromDraggingRowKey } from "@pensive/web/helpers/optionsDnD";

describe("option drag payloads", () => {
  it.each([
    ["category:Food", "category"],
    ["subcategory:Food:Groceries", "subcategory"],
    ["incomeType:Salary", "incomeType"],
    ["incomeSubtype:Salary:Bonus", "incomeSubtype"],
  ])("parses %s", (key, expected) => {
    expect(kindFromDraggingRowKey(key)).toBe(expected);
  });

  it.each([null, "", "unknown:thing"])("rejects %j", (key) => {
    expect(kindFromDraggingRowKey(key)).toBeNull();
  });
});
