export type SplitExpenseDraft = {
  expense: string;
  account: string;
  category: string;
  subcategory: string;
  amount: string;
  date: string;
  monthYears: string[];
  paidTo: string;
  notes: string;
  comments: string;
};

export type SplitIncomingDraft = {
  incoming: string;
  paidBy: string;
  incomeType: string;
  incomeSubtype: string;
  account: string;
  amount: string;
  date: string;
  monthYears: string[];
  notes: string;
  comments: string;
};
