import type { SplitExpenseDraft, SplitIncomingDraft } from "../types/splitDrafts";

export function buildEmptySplitExpenseDraft(
  todayIsoDate: string,
): SplitExpenseDraft {
  return {
    expense: "",
    type: "",
    account: "",
    category: "",
    subcategory: "",
    amount: "",
    date: todayIsoDate,
    paidTo: "",
    notes: "",
    comments: "",
  };
}

export function buildEmptySplitIncomingDraft(
  todayIsoDate: string,
): SplitIncomingDraft {
  return {
    incoming: "",
    paidBy: "",
    incomeType: "",
    incomeSubtype: "",
    account: "",
    amount: "",
    date: todayIsoDate,
    monthYear: "",
    notes: "",
    comments: "",
  };
}