// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { columnLabel, normalizeCells, parseNumberArray, parseSizeMap } from "@pensive/web/helpers/notepad";

describe("notepad helpers", () => {
  it("normalizes ragged cells into a rectangular matrix", () => {
    expect(normalizeCells([["a"], ["b", "c"]])).toEqual([
      ["a", ""],
      ["b", "c"],
    ]);
    expect(normalizeCells(undefined)).toEqual([[""]]);
  });

  it("parses bounded numeric arrays with fallbacks", () => {
    expect(parseNumberArray('[1, 2.6, -2, "bad"]', 4, 10, 1)).toEqual([
      1, 3, 1, 10,
    ]);
    expect(parseNumberArray("bad", 2, 8, 1)).toEqual([8, 8]);
  });

  it("parses only numeric size-map entries", () => {
    expect(parseSizeMap('{"0":[10,"bad",20],"x":"bad"}')).toEqual({
      "0": [10, 20],
    });
  });

  it.each([
    [0, "A"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [51, "AZ"],
    [52, "BA"],
  ])("labels column %s", (index, expected) => {
    expect(columnLabel(index)).toBe(expected);
  });
});
