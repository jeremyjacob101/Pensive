export const expenseHeaders = [
  "Expense",
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
  { key: "account", label: "Account" },
  { key: "category", label: "Category" },
  { key: "subcategory", label: "Subcategory" },
  { key: "incomeType", label: "Income Type" },
  { key: "incomeSubtype", label: "Income Subtype" },
] as const;

export type OptionKind = (typeof optionKinds)[number]["key"];
