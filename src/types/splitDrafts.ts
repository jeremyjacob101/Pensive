export type SplitExpenseDraft = {
  expense: string;
  type: string;
  account: string;
  category: string;
  amount: string;
  date: string;
  paidTo: string;
  notes: string;
  comments: string;
};

export type SplitIncomingDraft = {
  incoming: string;
  paidBy: string;
  incomeType: string;
  account: string;
  amount: string;
  date: string;
  monthYear: string;
  notes: string;
  comments: string;
};
