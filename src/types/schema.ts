export const expenseHeaders = [
  "Expense",
  "Type",
  "Account",
  "Category",
  "Subcategory",
  "Amount",
  "Date",
  "PaidTo",
  "Notes",
  "Comments",
  "ExpenseID",
  "BaseExpenseID",
  "SubExpenseID",
] as const;

export const incomingHeaders = [
  "Incoming",
  "PaidBy",
  "IncomeType",
  "IncomeSubtype",
  "Account",
  "Amount",
  "Date",
  "MonthYear",
  "Notes",
  "Comments",
  "IncomingID",
  "BaseIncomingID",
  "SubIncomingID",
] as const;

export const recurringHeaders = [
  "Status",
  "Kind",
  "Name",
  "ExpenseType",
  "ExpenseAccount",
  "ExpenseCategory",
  "ExpenseSubcategory",
  "ExpensePaidTo",
  "IncomingPaidBy",
  "IncomingType",
  "IncomingSubtype",
  "IncomingAccount",
  "Price",
  "Frequency",
  "Day of Month",
  "Notes",
] as const;

export const optionKinds = [
  { key: "expenseType", label: "Expense Type" },
  { key: "account", label: "Account" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "incomeType", label: "Income Type" },
  { key: "incomeSubtype", label: "Income Subtype" },
] as const;

export type OptionKind = (typeof optionKinds)[number]["key"];
