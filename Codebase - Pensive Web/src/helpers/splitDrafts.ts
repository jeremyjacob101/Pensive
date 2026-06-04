import type { SplitExpenseDraft, SplitIncomingDraft } from "../types/splitDrafts";

export function buildEmptySplitExpenseDraft(
  todayIsoDate: string,
): SplitExpenseDraft {
  const month = todayIsoDate.slice(0, 7);
  return {
    expense: "",
    account: "",
    category: "",
    subcategory: "",
    amount: "",
    date: todayIsoDate,
    monthYears: month ? [month] : [],
    paidTo: "",
    notes: "",
    comments: "",
  };
}

export function buildEmptySplitIncomingDraft(
  todayIsoDate: string,
): SplitIncomingDraft {
  const month = todayIsoDate.slice(0, 7);
  return {
    incoming: "",
    paidBy: "",
    incomeType: "",
    incomeSubtype: "",
    account: "",
    amount: "",
    date: todayIsoDate,
    monthYears: month ? [month] : [],
    notes: "",
    comments: "",
  };
}