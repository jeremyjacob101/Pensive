export const expenseHeaders = [
  "Expense",
  "Type",
  "Account",
  "Category",
  "Amount",
  "Date",
  "PaidTo",
  "Notes",
  "Comments",
  "ExpenseID",
] as const;

export const incomingHeaders = [
  "Incoming",
  "PaidBy",
  "IncomeType",
  "Account",
  "Amount",
  "Date",
  "MonthYear",
  "Notes",
  "Comments",
  "IncomingID",
] as const;

export const recurringHeaders = [
  "Status",
  "Kind",
  "Name",
  "ExpenseType",
  "ExpenseAccount",
  "ExpenseCategory",
  "ExpensePaidTo",
  "IncomingPaidBy",
  "IncomingType",
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
  { key: "incomeType", label: "Income Type" },
] as const;

export type OptionKind = (typeof optionKinds)[number]["key"];
