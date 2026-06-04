export type TopRowSearchState = {
  expenseSearchQuery: string;
  setExpenseSearchQuery: (value: string) => void;
  expenseSelectedSearchFields: string[];
  setExpenseSelectedSearchFields: (value: string[]) => void;
  incomingSearchQuery: string;
  setIncomingSearchQuery: (value: string) => void;
  incomingSelectedSearchFields: string[];
  setIncomingSelectedSearchFields: (value: string[]) => void;
  setVisibleExpenseIds: (value: string[]) => void;
  setVisibleIncomingIds: (value: string[]) => void;
  setVisibleExpenseCategories: (value: string[]) => void;
  setVisibleIncomingTypes: (value: string[]) => void;
};

export type SearchFieldOption = {
  value: string;
  label: string;
};
