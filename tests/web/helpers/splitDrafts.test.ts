// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildEmptySplitExpenseDraft, buildEmptySplitIncomingDraft } from "@pensive/web/helpers/splitDrafts";

describe("split-entry draft factories", () => {
  it("seeds an expense draft from the selected date", () => {
    expect(buildEmptySplitExpenseDraft("2025-04-15")).toMatchObject({
      date: "2025-04-15",
      monthYears: ["2025-04"],
      amount: "",
      expense: "",
    });
  });

  it("seeds an incoming draft from the selected date", () => {
    expect(buildEmptySplitIncomingDraft("2025-04-15")).toMatchObject({
      date: "2025-04-15",
      monthYears: ["2025-04"],
      amount: "",
      incoming: "",
    });
  });
});
