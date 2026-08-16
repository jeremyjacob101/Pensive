// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isScrollKey, isTypingTarget } from "@pensive/web/helpers/bottomSentinel";

describe("bottom sentinel helpers", () => {
  it.each(["ArrowDown", "PageDown", "End", " "])(
    "recognizes %s as a scroll key",
    (key) => expect(isScrollKey({ key } as KeyboardEvent)).toBe(true),
  );

  it("recognizes typing controls and contenteditable elements", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(div)).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
