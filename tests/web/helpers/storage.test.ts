// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseStoredList } from "@pensive/web/helpers/storage";

describe("stored list parsing", () => {
  it("keeps only string entries", () => {
    expect(parseStoredList('["a", 1, null, "b"]')).toEqual(["a", "b"]);
  });

  it.each(["bad", "{}", "null", ""])("returns an empty list for %j", (
    value,
  ) => {
    expect(parseStoredList(value)).toEqual([]);
  });
});
