const DEFAULT_EXPENSE_KINDS = ["Regular", "Reimbursement", "Transfer"];

const DEFAULT_ACCOUNTS = ["Checking", "Savings", "Cash", "Credit Card"];

const DEFAULT_EXPENSE_CATEGORIES = [
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

const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Bonus",
  "Gift",
  "Refund",
  "Investment",
  "Other",
];

const DEFAULT_SUBCATEGORIES = {
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

const DEFAULT_INCOME_SUBCATEGORIES = {
  Salary: ["Primary Job"],
  Bonus: ["Performance", "Holiday"],
  Gift: ["Personal", "General"],
  Refund: ["Return", "Adjustment"],
  Investment: ["Interest", "Dividends"],
  Other: ["Miscellaneous"],
};

const DEFAULT_COUNTERPARTY_SUGGESTIONS = {
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

const DEFAULT_RECURRING_TEMPLATES = [];
const DEFAULT_IMPORTANT_DATES = [];

module.exports = {
  DEFAULT_ACCOUNTS,
  DEFAULT_COUNTERPARTY_SUGGESTIONS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_KINDS,
  DEFAULT_IMPORTANT_DATES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INCOME_SUBCATEGORIES,
  DEFAULT_RECURRING_TEMPLATES,
  DEFAULT_SUBCATEGORIES,
};
