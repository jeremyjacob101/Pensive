export type DefaultRecurringTemplate = {
  type: "expense" | "income";
  status: string;
  name: string;
  amount: number;
  frequency: string;
  dayOfMonth: number;
  account: string | null;
  category: string | null;
  entryKind: string | null;
  counterparty: string | null;
  notes: string | null;
};

export type DefaultImportantDateTemplate = {
  name: string;
  date: string;
  notes: string | null;
};

export const DEFAULT_EXPENSE_KINDS = ["Regular", "Reimbursement", "Transfer"];
export const DEFAULT_ACCOUNTS = ["Checking", "Savings", "Cash", "Credit Card"];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Groceries",
  "Transportation",
  "Health",
  "Shopping",
  "Entertainment",
  "Travel",
  "Work",
  "Other",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Bonus",
  "Gift",
  "Refund",
  "Investment",
  "Other",
];

export const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  Housing: ["Rent", "Maintenance", "Supplies"],
  Utilities: ["Electric", "Water", "Internet", "Phone"],
  Groceries: ["Supermarket", "Market", "Household"],
  Transportation: ["Fuel", "Transit", "Parking"],
  Health: ["Pharmacy", "Medical", "Fitness"],
  Shopping: ["Clothing", "Home", "General"],
  Entertainment: ["Streaming", "Games", "Events"],
  Travel: ["Flights", "Hotels", "Transit"],
  Work: ["Software", "Equipment", "Education"],
  Other: ["Miscellaneous"],
};

export const DEFAULT_INCOME_SUBCATEGORIES: Record<string, string[]> = {
  Salary: ["Primary Job"],
  Bonus: ["Performance", "Holiday"],
  Gift: ["Personal", "General"],
  Refund: ["Return", "Adjustment"],
  Investment: ["Interest", "Dividends"],
  Other: ["Miscellaneous"],
};

export const DEFAULT_COUNTERPARTY_SUGGESTIONS = {
  expense: [
    "Landlord",
    "Utility Provider",
    "Grocery Store",
    "Transit Service",
    "Pharmacy",
    "Online Store",
  ],
  income: ["Employer", "Client", "Bank", "Individual", "Marketplace"],
};

export const DEFAULT_RECURRING_TEMPLATES: DefaultRecurringTemplate[] = [];
export const DEFAULT_IMPORTANT_DATES: DefaultImportantDateTemplate[] = [];
