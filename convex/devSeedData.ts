export type SeedProfile = "realistic" | "stress";
export type SeedEffectiveAmountMode = "auto" | "manual";

export type SeedExpenseRow = {
  key: string;
  expense: string;
  account: string;
  category: string;
  subcategory?: string;
  amount: number;
  effectiveAmount: number;
  effectiveAmountMode: SeedEffectiveAmountMode;
  monthYears: string[];
  date: string;
  paidTo: string;
  notes?: string;
  comments?: string;
  expenseId: string;
  baseExpenseId?: string;
  baseExpenseLabel?: string;
  subExpenseId?: string;
};

export type SeedIncomingRow = {
  key: string;
  incoming: string;
  paidBy: string;
  incomeType: string;
  incomeSubtype?: string;
  account: string;
  amount: number;
  effectiveAmount: number;
  effectiveAmountMode: SeedEffectiveAmountMode;
  date: string;
  monthYears: string[];
  notes?: string;
  comments?: string;
  incomingId: string;
  baseIncomingId?: string;
  subIncomingId?: string;
};

export type SeedPaybackLink = {
  expenseKey: string;
  incomingKey: string;
  allocatedAmount: number;
  notes?: string;
};

export type SeedOptionKind =
  | "account"
  | "category"
  | "subcategory"
  | "incomeType"
  | "incomeSubtype";

export type SeedOption = {
  kind: SeedOptionKind;
  value: string;
  parentValue?: string;
  color?: string;
  isDefault?: boolean;
  isTracking?: boolean;
};

export type SeedRecurring = {
  status: "active" | "inactive";
  kind: "expense" | "incoming";
  name: string;
  amount: number;
  frequency: "Monthly";
  dayOfMonth: number;
  recurringExpenseAccount?: string;
  recurringExpenseCategory?: string;
  recurringExpenseSubcategory?: string;
  recurringExpensePaidTo?: string;
  recurringIncomingPaidBy?: string;
  recurringIncomingType?: string;
  recurringIncomingSubtype?: string;
  recurringIncomingAccount?: string;
  notes?: string;
};

export type SeedNote = {
  id: string;
  title: string;
  content: string;
};

export type SeedTable = {
  id: string;
  title: string;
  cells: string[][];
};

export type SeedSavingsBank = {
  key: string;
  name: string;
  color: string;
  currency: "ILS" | "USD";
  interestEnabled: boolean;
  annualInterestRate: number;
  compounding: "monthly" | "yearly";
  sortOrder: number;
};

export type SeedSavingsEntry = {
  bankKey: string;
  date: string;
  amount: number;
  currency: "ILS" | "USD";
  note?: string;
};

export type SeedData = {
  profile: SeedProfile;
  seed: number;
  asOfDate: string;
  expenses: SeedExpenseRow[];
  incomings: SeedIncomingRow[];
  paybackLinks: SeedPaybackLink[];
  options: SeedOption[];
  recurrings: SeedRecurring[];
  notes: SeedNote[];
  tables: SeedTable[];
  savingsBanks: SeedSavingsBank[];
  savingsEntries: SeedSavingsEntry[];
  savingsSettings: {
    displayCurrency: "ILS" | "USD";
    manualUsdIlsRate: number;
  };
  exchangeRate: {
    pair: string;
    base: string;
    quote: string;
    rate: number;
    rateDate: string;
    source: string;
  };
};

type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(values: readonly T[]) => T;
  chance: (probability: number) => boolean;
};

type ExpenseProfile = {
  category: string;
  weight: number;
  subcategories: readonly string[];
  merchants: readonly string[];
  names: readonly string[];
  min: number;
  max: number;
};

type RecurringExpenseTemplate = {
  status: "active" | "inactive";
  kind: "expense";
  name: string;
  amount: number;
  dayOfMonth: number;
  account: string;
  category: string;
  subcategory?: string;
  paidTo: string;
  notes?: string;
};

type RecurringIncomingTemplate = {
  status: "active" | "inactive";
  kind: "incoming";
  name: string;
  amount: number;
  dayOfMonth: number;
  paidBy: string;
  incomeType: string;
  incomeSubtype?: string;
  account: string;
  notes?: string;
};

const COLOR_PALETTE = [
  "#1D0FDB",
  "#CE2E12",
  "#EF5D1F",
  "#1CC6E9",
  "#E63D3D",
  "#8246E6",
  "#EB19D7",
  "#A0A0A0",
  "#921CF2",
  "#0AA608",
  "#81620E",
  "#4389FF",
  "#FF6758",
  "#5EAE8C",
  "#D18B22",
];

const ACCOUNTS = [
  "Primary Checking",
  "Partner Checking",
  "Partner Foreign Account",
  "Family Shared",
  "Cash Wallet",
  "Gift Card",
  "Transfer Holding",
  "Emergency Savings",
] as const;

const EXPENSE_PROFILES: readonly ExpenseProfile[] = [
  {
    category: "Grocery",
    weight: 22,
    subcategories: ["Makolet", "Supermarket/Deal"],
    merchants: [
      "Corner Market",
      "Fresh Basket",
      "Rami Market",
      "Neighborhood Makolet",
    ],
    names: [
      "Weekly groceries",
      "Fruit and vegetables",
      "Pantry restock",
      "Household groceries",
    ],
    min: 8,
    max: 480,
  },
  {
    category: "Meal",
    weight: 12,
    subcategories: ["Restaurant", "Takeout", "Coffee"],
    merchants: [
      "Local Cafe",
      "Falafel Corner",
      "Delivery Kitchen",
      "Friday Restaurant",
    ],
    names: ["Lunch", "Dinner out", "Coffee and pastry", "Takeout night"],
    min: 12,
    max: 420,
  },
  {
    category: "Bills",
    weight: 10,
    subcategories: [
      "Phone Bills",
      "Health Bills",
      "Credit Card Bills",
      "Government Bills",
    ],
    merchants: [
      "Mobile Provider",
      "Health Fund",
      "Card Services",
      "City Services",
    ],
    names: [
      "Phone bill",
      "Health contribution",
      "Service charge",
      "Government payment",
    ],
    min: 25,
    max: 650,
  },
  {
    category: "Utilities",
    weight: 7,
    subcategories: [
      "Wifi Bills",
      "Gas Bills",
      "Water Bills",
      "Electric Bills",
      "Arnona Bills",
    ],
    merchants: [
      "Electric Company",
      "Water Authority",
      "City Hall",
      "Home Internet",
      "Gas Supplier",
    ],
    names: [
      "Electricity",
      "Water bill",
      "Internet",
      "Gas refill",
      "Municipal bill",
    ],
    min: 40,
    max: 1_200,
  },
  {
    category: "Supplies",
    weight: 9,
    subcategories: ["Apartment", "Furniture", "Misc Supplies", "Apt Upkeep"],
    merchants: [
      "Home Center",
      "Hardware Shop",
      "Furniture Outlet",
      "Online Marketplace",
    ],
    names: [
      "Apartment supplies",
      "Home repair",
      "Storage and organization",
      "Furniture part",
    ],
    min: 15,
    max: 2_600,
  },
  {
    category: "Transportation",
    weight: 7,
    subcategories: ["Fuel", "Public Transit", "Parking", "Car Maintenance"],
    merchants: ["Fuel Station", "Transit Card", "City Parking", "Auto Service"],
    names: ["Fuel", "Bus and train", "Parking", "Car maintenance"],
    min: 8,
    max: 1_100,
  },
  {
    category: "Leisure",
    weight: 7,
    subcategories: ["Entertainment", "Subscriptions", "Games", "Friends Gifts"],
    merchants: [
      "Cinema",
      "Streaming Service",
      "Bookshop",
      "Outdoor Store",
      "Game Store",
    ],
    names: [
      "Movie night",
      "Subscription",
      "Book",
      "Weekend activity",
      "Gift for a friend",
    ],
    min: 7,
    max: 900,
  },
  {
    category: "Medical",
    weight: 4,
    subcategories: ["Medicine", "Doctor Bills", "one time big med"],
    merchants: ["Pharmacy", "Clinic", "Specialist", "Medical Center"],
    names: ["Prescription", "Doctor visit", "Lab work", "Medical equipment"],
    min: 20,
    max: 3_800,
  },
  {
    category: "Travel",
    weight: 4,
    subcategories: [
      "Flights",
      "Hotels",
      "Travel Supplies",
      "2026 - Jun - Galil",
    ],
    merchants: ["Airline", "Hotel", "Travel Agency", "Train Station"],
    names: ["Flight deposit", "Hotel night", "Travel booking", "Trip supplies"],
    min: 40,
    max: 6_500,
  },
  {
    category: "Management",
    weight: 3,
    subcategories: ["Subscriptions", "Professional", "Misc Bills"],
    merchants: [
      "Productivity Service",
      "Cloud Software",
      "Professional Service",
    ],
    names: ["Software subscription", "Professional fee", "Account service"],
    min: 20,
    max: 700,
  },
  {
    category: "Work",
    weight: 2,
    subcategories: ["Work Supplies", "Client Expense", "Professional"],
    merchants: ["Office Store", "Coworking Space", "Client Vendor"],
    names: ["Work supplies", "Client expense", "Coworking day"],
    min: 20,
    max: 1_800,
  },
  {
    category: "Tzedekah",
    weight: 2,
    subcategories: ["Charity", "Community"],
    merchants: ["Community Fund", "Charity Organization", "Local Campaign"],
    names: ["Charity", "Community support", "Donation"],
    min: 18,
    max: 1_000,
  },
  {
    category: "Misc",
    weight: 8,
    subcategories: ["Misc", "Presents", "Old Bills"],
    merchants: [
      "Online Marketplace",
      "Local Vendor",
      "Service Provider",
      "Event Vendor",
    ],
    names: [
      "Miscellaneous purchase",
      "Gift",
      "Unexpected expense",
      "Event expense",
    ],
    min: 10,
    max: 2_400,
  },
];

const RECURRING_EXPENSES: readonly RecurringExpenseTemplate[] = [
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Apartment rent",
    amount: 6_200,
    dayOfMonth: 2,
    account: "Primary Checking",
    category: "Rent",
    subcategory: "Apartment",
    paidTo: "North Star Property",
    notes: "Mock recurring rent",
  },
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Mobile plan",
    amount: 42,
    dayOfMonth: 11,
    account: "Family Shared",
    category: "Bills",
    subcategory: "Phone Bills",
    paidTo: "Mobile Provider",
  },
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Health plan",
    amount: 96,
    dayOfMonth: 5,
    account: "Primary Checking",
    category: "Bills",
    subcategory: "Health Bills",
    paidTo: "Health Fund",
  },
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Home internet",
    amount: 118,
    dayOfMonth: 17,
    account: "Partner Checking",
    category: "Utilities",
    subcategory: "Wifi Bills",
    paidTo: "Home Internet",
  },
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Streaming bundle",
    amount: 69,
    dayOfMonth: 28,
    account: "Family Shared",
    category: "Leisure",
    subcategory: "Subscriptions",
    paidTo: "Streaming Service",
  },
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Cloud workspace",
    amount: 39,
    dayOfMonth: 8,
    account: "Partner Foreign Account",
    category: "Management",
    subcategory: "Subscriptions",
    paidTo: "Cloud Software",
  },
  {
    status: "active" as const,
    kind: "expense" as const,
    name: "Monthly charity",
    amount: 180,
    dayOfMonth: 20,
    account: "Primary Checking",
    category: "Tzedekah",
    subcategory: "Charity",
    paidTo: "Community Fund",
  },
  {
    status: "inactive" as const,
    kind: "expense" as const,
    name: "Old apartment rent",
    amount: 7_000,
    dayOfMonth: 1,
    account: "Primary Checking",
    category: "Rent",
    subcategory: "Apartment",
    paidTo: "Former Property",
    notes: "Inactive historical recurring item",
  },
] as const;

const RECURRING_INCOMINGS: readonly RecurringIncomingTemplate[] = [
  {
    status: "active" as const,
    kind: "incoming" as const,
    name: "Family monthly support",
    amount: 1_400,
    dayOfMonth: 6,
    paidBy: "Family Shared",
    incomeType: "Gift",
    incomeSubtype: "Family Monthly",
    account: "Family Shared",
    notes: "Mock recurring support",
  },
  {
    status: "active" as const,
    kind: "incoming" as const,
    name: "Contract retainer",
    amount: 2_800,
    dayOfMonth: 15,
    paidBy: "Northwind Studio",
    incomeType: "Job",
    incomeSubtype: "Contract",
    account: "Primary Checking",
  },
  {
    status: "inactive" as const,
    kind: "incoming" as const,
    name: "Old side project retainer",
    amount: 950,
    dayOfMonth: 25,
    paidBy: "Former Client",
    incomeType: "Job",
    incomeSubtype: "Freelance",
    account: "Primary Checking",
    notes: "Inactive historical recurring item",
  },
] as const;

const BIG_PURCHASES = [
  {
    name: "New laptop and monitor",
    category: "Work",
    subcategory: "Work Supplies",
    paidTo: "Electronics Outlet",
    min: 4_800,
    max: 9_600,
  },
  {
    name: "Moving truck and furniture",
    category: "Supplies",
    subcategory: "Furniture",
    paidTo: "Moving Company",
    min: 3_200,
    max: 8_800,
  },
  {
    name: "Family trip deposit",
    category: "Travel",
    subcategory: "Flights",
    paidTo: "Airline",
    min: 5_400,
    max: 13_500,
  },
  {
    name: "One-time medical procedure",
    category: "Medical",
    subcategory: "one time big med",
    paidTo: "Medical Center",
    min: 2_400,
    max: 7_500,
  },
  {
    name: "Large event deposit",
    category: "Misc",
    subcategory: "Presents",
    paidTo: "Event Vendor",
    min: 3_500,
    max: 12_000,
  },
  {
    name: "Emergency appliance replacement",
    category: "Supplies",
    subcategory: "Apartment",
    paidTo: "Home Center",
    min: 1_800,
    max: 6_200,
  },
] as const;

const BULK_GROUP_LABELS = [
  "Home move bulk purchase",
  "Holiday grocery bulk",
  "Apartment repair bulk",
  "Trip planning bulk",
  "Event supplies bulk",
  "Work equipment bulk",
] as const;

function hashSeed(seed: number) {
  let value = seed >>> 0 || 0x9e3779b9;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return value >>> 0;
}

function makeRng(seed: number): Rng {
  let state = hashSeed(seed);
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(values) {
      if (values.length === 0)
        throw new Error("Cannot pick from an empty list");
      return values[Math.floor(next() * values.length)]!;
    },
    chance(probability) {
      return next() < probability;
    },
  };
}

function weightedPick<T extends { weight: number }>(
  rng: Rng,
  values: readonly T[],
) {
  const total = values.reduce((sum, value) => sum + value.weight, 0);
  let cursor = rng.next() * total;
  for (const value of values) {
    cursor -= value.weight;
    if (cursor <= 0) return value;
  }
  return values[values.length - 1]!;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid seed date: ${value}`);
  }
  return date;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function addMonths(value: string, months: number) {
  const date = parseDate(monthStart(value));
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatDate(date);
}

function daysInMonth(value: string) {
  const date = parseDate(monthStart(value));
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.getUTCDate();
}

function monthKeysBetween(startMonth: string, endDate: string) {
  const result: string[] = [];
  let cursor = monthStart(startMonth);
  const endMonth = monthStart(endDate);
  while (cursor <= endMonth) {
    result.push(cursor.slice(0, 7));
    cursor = addMonths(cursor, 1);
  }
  return result;
}

function monthYearsFor(date: string) {
  return [date.slice(0, 7)];
}

function randomDateInMonth(rng: Rng, month: string, asOfDate: string) {
  const first = `${month}-01`;
  const lastDay = daysInMonth(first);
  const candidate = `${month}-${String(rng.int(1, lastDay)).padStart(2, "0")}`;
  return candidate > asOfDate ? asOfDate : candidate;
}

function dateOnDay(month: string, day: number, asOfDate: string) {
  const safeDay = Math.min(day, daysInMonth(`${month}-01`));
  const candidate = `${month}-${String(safeDay).padStart(2, "0")}`;
  return candidate > asOfDate ? asOfDate : candidate;
}

function randomMoney(rng: Rng, min: number, max: number, skew = 1.35) {
  const value = min + Math.pow(rng.next(), skew) * (max - min);
  return roundMoney(Math.max(0.01, value));
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function buildRecurringRows() {
  return [
    ...RECURRING_EXPENSES.map((row) => ({
      status: row.status,
      kind: row.kind,
      name: row.name,
      amount: row.amount,
      frequency: "Monthly" as const,
      dayOfMonth: row.dayOfMonth,
      recurringExpenseAccount: row.account,
      recurringExpenseCategory: row.category,
      recurringExpenseSubcategory: row.subcategory,
      recurringExpensePaidTo: row.paidTo,
      notes: row.notes,
    })),
    ...RECURRING_INCOMINGS.map((row) => ({
      status: row.status,
      kind: row.kind,
      name: row.name,
      amount: row.amount,
      frequency: "Monthly" as const,
      dayOfMonth: row.dayOfMonth,
      recurringIncomingPaidBy: row.paidBy,
      recurringIncomingType: row.incomeType,
      recurringIncomingSubtype: row.incomeSubtype,
      recurringIncomingAccount: row.account,
      notes: row.notes,
    })),
  ];
}

function addHistoricalRecurringRows(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
) {
  for (const [templateIndex, template] of RECURRING_EXPENSES.entries()) {
    for (const month of months) {
      const date = dateOnDay(month, template.dayOfMonth, asOfDate);
      const amount =
        template.name === "Apartment rent"
          ? template.amount
          : roundMoney(template.amount * (0.9 + rng.next() * 0.2));
      const key = `seed-recurring-expense-${templateIndex}-${month}`;
      data.expenses.push({
        key,
        expense: template.name,
        account: template.account,
        category: template.category,
        subcategory: template.subcategory,
        amount,
        effectiveAmount: amount,
        effectiveAmountMode: "auto",
        monthYears: monthYearsFor(date),
        date,
        paidTo: template.paidTo,
        notes: template.notes,
        comments: rng.chance(0.06) ? "Generated recurring history" : undefined,
        expenseId: key,
      });
    }
  }

  for (const [templateIndex, template] of RECURRING_INCOMINGS.entries()) {
    for (const month of months) {
      const date = dateOnDay(month, template.dayOfMonth, asOfDate);
      const amount = roundMoney(template.amount * (0.92 + rng.next() * 0.16));
      const key = `seed-recurring-incoming-${templateIndex}-${month}`;
      data.incomings.push({
        key,
        incoming: template.name,
        paidBy: template.paidBy,
        incomeType: template.incomeType,
        incomeSubtype: template.incomeSubtype,
        account: template.account,
        amount,
        effectiveAmount: amount,
        effectiveAmountMode: "auto",
        date,
        monthYears: monthYearsFor(date),
        notes: template.notes,
        incomingId: key,
      });
    }
  }
}

function pickExpenseAccount(rng: Rng, category: string) {
  if (category === "Travel" || category === "Work") {
    return rng.pick([
      "Primary Checking",
      "Partner Checking",
      "Partner Foreign Account",
    ] as const);
  }
  if (category === "Utilities" || category === "Rent") {
    return rng.pick([
      "Primary Checking",
      "Partner Checking",
      "Family Shared",
    ] as const);
  }
  return rng.pick([
    "Primary Checking",
    "Primary Checking",
    "Partner Checking",
    "Family Shared",
    "Cash Wallet",
    "Gift Card",
  ] as const);
}

function addVariableExpenses(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
  countPerMonth: number,
  variance: number,
) {
  let sequence = 0;
  for (const month of months) {
    const count = Math.max(1, countPerMonth + rng.int(-variance, variance));
    for (let index = 0; index < count; index += 1) {
      const profile = weightedPick(rng, EXPENSE_PROFILES);
      const subcategory = rng.chance(0.07)
        ? undefined
        : rng.pick(profile.subcategories);
      const amount = randomMoney(rng, profile.min, profile.max);
      const key = `seed-variable-expense-${String(sequence++).padStart(6, "0")}`;
      const date = randomDateInMonth(rng, month, asOfDate);
      const notes = rng.chance(0.11)
        ? rng.pick([
            "Mock purchase",
            "Paid by card",
            "Split with household",
            "Entered from receipt",
            "Need to review later",
          ] as const)
        : undefined;
      const comments = rng.chance(0.06)
        ? rng.pick([
            "Receipt saved",
            "Shared expense",
            "One part was reimbursed",
            "Bought during a busy week",
          ] as const)
        : undefined;
      data.expenses.push({
        key,
        expense: rng.pick(profile.names),
        account: pickExpenseAccount(rng, profile.category),
        category: profile.category,
        subcategory,
        amount,
        effectiveAmount: amount,
        effectiveAmountMode: "auto",
        monthYears: monthYearsFor(date),
        date,
        paidTo: rng.pick(profile.merchants),
        notes,
        comments,
        expenseId: key,
      });
    }
  }
}

function addBulkExpenseGroups(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
  groupsPerMonth: number,
) {
  let sequence = 0;
  for (const [monthIndex, month] of months.entries()) {
    for (let groupIndex = 0; groupIndex < groupsPerMonth; groupIndex += 1) {
      const baseExpenseId = `seed-bulk-expense-${monthIndex}-${groupIndex}`;
      const baseExpenseLabel = rng.pick(BULK_GROUP_LABELS);
      const lineCount = rng.int(3, 7);
      const anchorDate = randomDateInMonth(rng, month, asOfDate);
      const profile = rng.pick(
        EXPENSE_PROFILES.filter((row) => row.category !== "Medical"),
      );
      for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
        const date = addDays(anchorDate, Math.min(lineIndex, 2));
        const safeDate = date > asOfDate ? asOfDate : date;
        const amount = randomMoney(
          rng,
          Math.max(8, profile.min),
          Math.min(profile.max, 2_400),
        );
        const key = `seed-bulk-line-${sequence++}`;
        data.expenses.push({
          key,
          expense: `${baseExpenseLabel} ${lineIndex + 1}`,
          account: pickExpenseAccount(rng, profile.category),
          category: profile.category,
          subcategory: rng.pick(profile.subcategories),
          amount,
          effectiveAmount: amount,
          effectiveAmountMode: "auto",
          monthYears: monthYearsFor(safeDate),
          date: safeDate,
          paidTo: rng.pick(profile.merchants),
          notes: lineIndex === 0 ? "Bulk/grouped mock purchase" : undefined,
          expenseId: key,
          baseExpenseId,
          baseExpenseLabel,
          subExpenseId: String(lineIndex + 1).padStart(3, "0"),
        });
      }
    }
  }
}

function addBigPurchases(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const purchase = rng.pick(BIG_PURCHASES);
    const month = months[(index * 7 + 2) % months.length]!;
    const date = randomDateInMonth(rng, month, asOfDate);
    const key = `seed-big-purchase-${String(index).padStart(4, "0")}`;
    const amount = randomMoney(rng, purchase.min, purchase.max, 0.9);
    data.expenses.push({
      key,
      expense: purchase.name,
      account: rng.pick([
        "Primary Checking",
        "Partner Checking",
        "Family Shared",
      ] as const),
      category: purchase.category,
      subcategory: purchase.subcategory,
      amount,
      effectiveAmount: amount,
      effectiveAmountMode: "auto",
      monthYears: monthYearsFor(date),
      date,
      paidTo: purchase.paidTo,
      notes: rng.pick([
        "One-time large purchase",
        "Planned major expense",
        "Mock purchase for testing charts",
      ] as const),
      comments:
        index % 5 === 0
          ? "Large purchase should stand out in breakdowns"
          : undefined,
      expenseId: key,
    });
  }
}

function addMultiMonthBills(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
) {
  const billCount = Math.max(4, Math.floor(months.length / 5));
  for (let index = 0; index < billCount; index += 1) {
    const month = months[(index * 9 + 3) % months.length]!;
    const date = randomDateInMonth(rng, month, asOfDate);
    const key = `seed-multimonth-bill-${index}`;
    const span = rng.int(6, 14);
    const monthYears = Array.from({ length: span }, (_, offset) =>
      addMonths(date, offset).slice(0, 7));
    const amount = randomMoney(rng, 1_200, 6_200, 1.1);
    data.expenses.push({
      key,
      expense: rng.pick([
        "Annual municipal bill",
        "Insurance installment",
        "Property tax plan",
      ] as const),
      account: rng.pick([
        "Primary Checking",
        "Partner Checking",
        "Partner Foreign Account",
      ] as const),
      category: "Utilities",
      subcategory: "Arnona Bills",
      amount,
      effectiveAmount: amount,
      effectiveAmountMode: "auto",
      monthYears,
      date,
      paidTo: rng.pick([
        "City Hall",
        "Insurance Provider",
        "Property Services",
      ] as const),
      notes: "Mock bill allocated across multiple months",
      expenseId: key,
    });
  }
}

function addTransfers(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const month = months[(index * 11 + 1) % months.length]!;
    const date = randomDateInMonth(rng, month, asOfDate);
    const amount = randomMoney(rng, 4_000, 32_000, 0.8);
    const transferLabel = rng.pick([
      "Household transfer",
      "Move money for rent",
      "Top up primary account",
      "Transfer to shared account",
    ] as const);
    const expenseKey = `seed-transfer-expense-${index}`;
    const incomingKey = `seed-transfer-incoming-${index}`;
    data.expenses.push({
      key: expenseKey,
      expense: transferLabel,
      account: "Transfer Holding",
      category: "Moving Money",
      subcategory: "Transfer",
      amount,
      effectiveAmount: 0,
      effectiveAmountMode: "manual",
      monthYears: monthYearsFor(date),
      date,
      paidTo: rng.pick([
        "Primary Checking",
        "Partner Checking",
        "Family Shared",
      ] as const),
      notes: "Mock internal transfer; excluded from effective spending",
      expenseId: expenseKey,
    });
    data.incomings.push({
      key: incomingKey,
      incoming: transferLabel,
      paidBy: "Transfer Holding",
      incomeType: "Even-Up",
      incomeSubtype: "Internal Transfer",
      account: rng.pick([
        "Primary Checking",
        "Partner Checking",
        "Family Shared",
      ] as const),
      amount,
      effectiveAmount: 0,
      effectiveAmountMode: "manual",
      date,
      monthYears: monthYearsFor(date),
      notes: "Mock internal transfer; excluded from effective income",
      incomingId: incomingKey,
    });
  }
}

function addRegularIncomings(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
) {
  for (const [monthIndex, month] of months.entries()) {
    const salaryDate = dateOnDay(month, 28, asOfDate);
    const salaryKey = `seed-salary-primary-${month}`;
    const salaryAmount = roundMoney(8_100 + rng.next() * 1_600);
    data.incomings.push({
      key: salaryKey,
      incoming: "Primary salary",
      paidBy: "Northwind Studio",
      incomeType: "Job",
      incomeSubtype: "Salary",
      account: "Primary Checking",
      amount: salaryAmount,
      effectiveAmount: salaryAmount,
      effectiveAmountMode: "auto",
      date: salaryDate,
      monthYears: monthYearsFor(salaryDate),
      notes: monthIndex % 6 === 0 ? "Salary with annual adjustment" : undefined,
      incomingId: salaryKey,
    });

    const partnerDate = dateOnDay(month, 10, asOfDate);
    const partnerKey = `seed-salary-partner-${month}`;
    const partnerAmount = roundMoney(10_200 + rng.next() * 3_400);
    data.incomings.push({
      key: partnerKey,
      incoming: "Partner salary",
      paidBy: "Brightline Labs",
      incomeType: "Job",
      incomeSubtype: "Salary",
      account: "Partner Foreign Account",
      amount: partnerAmount,
      effectiveAmount: partnerAmount,
      effectiveAmountMode: "auto",
      date: partnerDate,
      monthYears: monthYearsFor(partnerDate),
      notes:
        monthIndex % 4 === 0 ? "Foreign salary conversion example" : undefined,
      incomingId: partnerKey,
    });

    if (monthIndex % 3 === 0) {
      const contractDate = dateOnDay(month, 15, asOfDate);
      const contractKey = `seed-contract-${month}`;
      const contractAmount = roundMoney(1_200 + rng.next() * 4_300);
      data.incomings.push({
        key: contractKey,
        incoming: "Freelance project payment",
        paidBy: "Northwind Studio",
        incomeType: "Job",
        incomeSubtype: "Freelance",
        account: "Primary Checking",
        amount: contractAmount,
        effectiveAmount: contractAmount,
        effectiveAmountMode: "auto",
        date: contractDate,
        monthYears: monthYearsFor(contractDate),
        notes: "Irregular project income",
        incomingId: contractKey,
      });
    }

    if (monthIndex % 4 === 1) {
      const giftDate = dateOnDay(month, 6, asOfDate);
      const giftKey = `seed-gift-${month}`;
      const giftAmount = roundMoney(450 + rng.next() * 2_000);
      data.incomings.push({
        key: giftKey,
        incoming: "Family gift",
        paidBy: "Family Shared",
        incomeType: "Gift",
        incomeSubtype: "Family Gift",
        account: "Family Shared",
        amount: giftAmount,
        effectiveAmount: giftAmount,
        effectiveAmountMode: "auto",
        date: giftDate,
        monthYears: monthYearsFor(giftDate),
        incomingId: giftKey,
      });
    }
  }
}

function addGroupedIncomings(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
) {
  const groupCount = Math.max(4, Math.floor(months.length / 4));
  for (let index = 0; index < groupCount; index += 1) {
    const month = months[(index * 8 + 4) % months.length]!;
    const baseIncomingId = `seed-grouped-income-${index}`;
    const baseAmount = randomMoney(rng, 1_800, 6_500, 1.1);
    const lineCount = rng.int(2, 4);
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const date = dateOnDay(month, 4 + lineIndex * 6, asOfDate);
      const key = `seed-grouped-income-line-${index}-${lineIndex}`;
      const amount = roundMoney(
        (baseAmount / lineCount) * (0.85 + rng.next() * 0.3),
      );
      data.incomings.push({
        key,
        incoming: `Catch-up payment ${index + 1}`,
        paidBy: "Northwind Studio",
        incomeType: "Job",
        incomeSubtype: "Catch-Up",
        account: "Primary Checking",
        amount,
        effectiveAmount: amount,
        effectiveAmountMode: "auto",
        date,
        monthYears: monthYearsFor(date),
        notes: lineIndex === 0 ? "Grouped incoming payment" : undefined,
        incomingId: key,
        baseIncomingId,
        subIncomingId: String(lineIndex + 1).padStart(3, "0"),
      });
    }
  }
}

function addOneTimeIncomings(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
  count: number,
) {
  const examples = [
    {
      name: "Annual bonus",
      incomeType: "Large One-Time",
      subtype: "Bonus",
      paidBy: "Northwind Studio",
      account: "Primary Checking",
      min: 7_000,
      max: 18_000,
      manualZero: false,
    },
    {
      name: "Tax refund",
      incomeType: "Government",
      subtype: "Refund",
      paidBy: "Tax Authority",
      account: "Primary Checking",
      min: 1_400,
      max: 8_500,
      manualZero: false,
    },
    {
      name: "Security deposit return",
      incomeType: "Large One-Time",
      subtype: "Deposit Return",
      paidBy: "Former Property",
      account: "Partner Checking",
      min: 3_000,
      max: 12_000,
      manualZero: false,
    },
    {
      name: "Pension release example",
      incomeType: "Large One-Time",
      subtype: "Windfall",
      paidBy: "Government Office",
      account: "Primary Checking",
      min: 8_000,
      max: 22_000,
      manualZero: true,
    },
  ] as const;

  for (let index = 0; index < count; index += 1) {
    const example = examples[index % examples.length]!;
    const month = months[(index * 13 + 5) % months.length]!;
    const date = randomDateInMonth(rng, month, asOfDate);
    const key = `seed-one-time-income-${index}`;
    const amount = randomMoney(rng, example.min, example.max, 0.9);
    data.incomings.push({
      key,
      incoming: example.name,
      paidBy: example.paidBy,
      incomeType: example.incomeType,
      incomeSubtype: example.subtype,
      account: example.account,
      amount,
      effectiveAmount: example.manualZero ? 0 : amount,
      effectiveAmountMode: example.manualZero ? "manual" : "auto",
      date,
      monthYears: monthYearsFor(date),
      notes: example.manualZero
        ? "Mock large receipt intentionally excluded from effective income"
        : "Mock one-time income",
      comments:
        index % 3 === 0
          ? "One-time item for breakdown and filtering"
          : undefined,
      incomingId: key,
    });
  }
}

function addPaybackGroups(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
  groupCount: number,
) {
  const eligibleExpenses = data.expenses.filter(
    (row) =>
      row.amount >= 20 &&
      row.category !== "Moving Money" &&
      row.effectiveAmountMode === "auto",
  );
  const usedExpenseKeys = new Set<string>();
  let cursor = rng.int(0, Math.max(0, eligibleExpenses.length - 1));

  for (
    let groupIndex = 0;
    groupIndex < groupCount && usedExpenseKeys.size < eligibleExpenses.length;
    groupIndex += 1
  ) {
    const groupSize = groupIndex % 7 === 0 ? 3 : groupIndex % 3 === 0 ? 2 : 1;
    const selected: SeedExpenseRow[] = [];
    let attempts = 0;
    while (
      selected.length < groupSize &&
      attempts < eligibleExpenses.length * 2
    ) {
      const expense = eligibleExpenses[cursor % eligibleExpenses.length]!;
      cursor = (cursor + rng.int(1, 11)) % eligibleExpenses.length;
      attempts += 1;
      if (usedExpenseKeys.has(expense.key)) continue;
      usedExpenseKeys.add(expense.key);
      selected.push(expense);
    }
    if (selected.length === 0) continue;

    const allocations = selected.map((expense) => {
      const ratio = rng.chance(0.18) ? 1 : 0.2 + rng.next() * 0.65;
      return roundMoney(Math.max(0.01, expense.amount * ratio));
    });
    const allocatedTotal = roundMoney(
      allocations.reduce((sum, value) => sum + value, 0),
    );
    const amount = roundMoney(allocatedTotal * (1 + rng.next() * 0.22));
    const month = months[(groupIndex * 5 + 2) % months.length]!;
    const date = randomDateInMonth(rng, month, asOfDate);
    const incomingKey = `seed-payback-income-${groupIndex}`;
    const paidBy = rng.pick([
      "Household Partner",
      "Family Shared",
      "Travel Friends",
      "Roommate",
      "Event Group",
      "Marketplace Buyer",
    ] as const);

    data.incomings.push({
      key: incomingKey,
      incoming:
        selected.length > 1
          ? "Shared expenses settlement"
          : `Payback — ${selected[0]!.expense}`,
      paidBy,
      incomeType: "Paid Back",
      incomeSubtype: selected.length > 1 ? "Bulk Payback" : "Shared Expense",
      account: rng.pick([
        "Primary Checking",
        "Partner Checking",
        "Family Shared",
      ] as const),
      amount,
      effectiveAmount: roundMoney(amount - allocatedTotal),
      effectiveAmountMode: "auto",
      date,
      monthYears: monthYearsFor(date),
      notes: rng.pick([
        "Partial reimbursement",
        "Shared cost settlement",
        "Payback received after purchase",
        "Mock reimbursement for linked expense",
      ] as const),
      comments:
        selected.length > 1
          ? "One incoming allocated across multiple expenses"
          : undefined,
      incomingId: incomingKey,
    });

    selected.forEach((expense, index) => {
      const allocatedAmount = allocations[index]!;
      expense.effectiveAmount = roundMoney(expense.amount - allocatedAmount);
      data.paybackLinks.push({
        expenseKey: expense.key,
        incomingKey,
        allocatedAmount,
        notes:
          allocatedAmount < expense.amount
            ? "Partial payback"
            : "Fully reimbursed",
      });
    });
  }
}

function addOptions(data: SeedData) {
  const accounts = unique([
    ...ACCOUNTS,
    ...data.expenses.map((row) => row.account),
    ...data.incomings.map((row) => row.account),
  ]);
  const categories = unique(data.expenses.map((row) => row.category));
  const subcategoryParents = new Map<string, string>();
  for (const row of data.expenses) {
    if (row.subcategory && !subcategoryParents.has(row.subcategory)) {
      subcategoryParents.set(row.subcategory, row.category);
    }
  }
  const subcategories = unique([
    ...EXPENSE_PROFILES.flatMap((row) => [...row.subcategories]),
    ...data.expenses.map((row) => row.subcategory ?? ""),
  ]);
  const incomeTypes = unique(data.incomings.map((row) => row.incomeType));
  const incomeSubtypeParents = new Map<string, string>();
  for (const row of data.incomings) {
    if (row.incomeSubtype && !incomeSubtypeParents.has(row.incomeSubtype)) {
      incomeSubtypeParents.set(row.incomeSubtype, row.incomeType);
    }
  }
  const incomeSubtypes = unique(
    data.incomings.map((row) => row.incomeSubtype ?? ""),
  );
  let colorIndex = 0;
  const add = (
    kind: SeedOptionKind,
    values: readonly string[],
    parentValues?: Map<string, string>,
    trackingValues?: ReadonlySet<string>,
  ) => {
    values.forEach((value, index) => {
      data.options.push({
        kind,
        value,
        parentValue: parentValues?.get(value),
        color: COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length],
        isDefault: index === 0,
        isTracking: trackingValues?.has(value),
      });
    });
  };

  add("account", accounts);
  add(
    "category",
    categories,
    undefined,
    new Set(["Grocery", "Bills", "Utilities", "Rent", "Medical"]),
  );
  add("subcategory", subcategories, subcategoryParents);
  add(
    "incomeType",
    incomeTypes,
    undefined,
    new Set(["Job", "Paid Back", "Government"]),
  );
  add("incomeSubtype", incomeSubtypes, incomeSubtypeParents);
}

function addNotepad(data: SeedData, profile: SeedProfile) {
  data.notes = [
    {
      id: "seed-note-household-overview",
      title: "Mock household overview",
      content:
        "This development workspace contains synthetic Pensive data. It includes recurring bills, large one-time purchases, grouped expenses, partial paybacks, internal transfers, and multi-month items.",
    },
    {
      id: "seed-note-large-purchases",
      title: "Large purchase review list",
      content:
        "Review the laptop, move, travel, medical, and event purchases in Expenses. They are intentionally spread across months for chart and date-range testing.",
    },
    {
      id: "seed-note-paybacks",
      title: "Payback follow-ups",
      content:
        "Some reimbursements are partial, some fully settle a purchase, and some incoming payments are linked to multiple expenses.",
    },
    {
      id: "seed-note-recurring",
      title: "Recurring items to review",
      content:
        "The seeded recurring list includes active and inactive expense templates plus recurring incoming templates. Running materialization on a safe date should exercise idempotency.",
    },
    {
      id: "seed-note-bulk",
      title: "Bulk and grouped entries",
      content:
        "Grouped expense rows share baseExpenseId and baseExpenseLabel. Grouped income rows share baseIncomingId and are useful for testing expand/collapse and filtering.",
    },
    {
      id: "seed-note-savings",
      title: "Savings scenarios",
      content:
        "Savings includes ILS and USD banks, monthly balance snapshots, interest settings, and a deterministic exchange rate.",
    },
    {
      id: "seed-note-stress",
      title: `${profile === "stress" ? "Stress" : "Full"} profile notes`,
      content:
        "Regenerate with a different seed to create a second synthetic dataset while keeping the same relationships and edge-case coverage.",
    },
  ];

  const header = [
    "Month",
    "Income",
    "Expenses",
    "Paybacks",
    "Savings",
    "Notes",
  ];
  const rows = [header];
  for (let index = 0; index < 18; index += 1) {
    rows.push([
      `Month ${index + 1}`,
      `${5_000 + index * 175}`,
      `${3_500 + index * 140}`,
      index % 3 === 0 ? "Review" : "Clear",
      `${12_000 + index * 425}`,
      index % 4 === 0 ? "Large purchase month" : "Normal month",
    ]);
  }
  data.tables = [
    {
      id: "seed-table-monthly-overview",
      title: "Mock monthly overview",
      cells: rows,
    },
    {
      id: "seed-table-purchase-plans",
      title: "Purchase planning",
      cells: [
        ["Item", "Category", "Expected", "Paid", "Reimbursed", "Status"],
        ["Laptop setup", "Work", "7200", "7200", "0", "Complete"],
        ["Move and furniture", "Supplies", "6400", "5200", "1200", "Partial"],
        ["Family trip", "Travel", "9800", "7600", "2200", "Partial"],
        ["Medical procedure", "Medical", "4100", "4100", "0", "Complete"],
        ["Event deposit", "Misc", "6800", "6800", "0", "Complete"],
      ],
    },
    {
      id: "seed-table-account-map",
      title: "Account map",
      cells: [
        ["Account", "Role", "Currency", "Owner", "Review"],
        ["Primary Checking", "Daily spending", "ILS", "Household", "Monthly"],
        ["Partner Checking", "Bills and travel", "ILS", "Household", "Monthly"],
        ["Partner Foreign Account", "Salary", "USD", "Household", "Monthly"],
        ["Family Shared", "Shared costs", "ILS", "Household", "As needed"],
        [
          "Transfer Holding",
          "Internal moves",
          "ILS",
          "Household",
          "Exclude from totals",
        ],
      ],
    },
  ];
}

function addSavings(
  data: SeedData,
  months: readonly string[],
  asOfDate: string,
  rng: Rng,
) {
  data.savingsBanks = [
    {
      key: "everyday",
      name: "Everyday Buffer",
      color: "#4389FF",
      currency: "ILS",
      interestEnabled: true,
      annualInterestRate: 0.5,
      compounding: "monthly",
      sortOrder: 0,
    },
    {
      key: "emergency",
      name: "Emergency Reserve",
      color: "#FF6758",
      currency: "USD",
      interestEnabled: true,
      annualInterestRate: 2.2,
      compounding: "monthly",
      sortOrder: 1,
    },
    {
      key: "long-term",
      name: "Long Term Goals",
      color: "#5EAE8C",
      currency: "ILS",
      interestEnabled: true,
      annualInterestRate: 4.75,
      compounding: "yearly",
      sortOrder: 2,
    },
    {
      key: "vacation",
      name: "Vacation Fund",
      color: "#D18B22",
      currency: "USD",
      interestEnabled: false,
      annualInterestRate: 0,
      compounding: "monthly",
      sortOrder: 3,
    },
  ];

  const baseBalances = new Map([
    ["everyday", 22_000],
    ["emergency", 8_500],
    ["long-term", 48_000],
    ["vacation", 2_800],
  ]);
  const increments = new Map([
    ["everyday", 550],
    ["emergency", 180],
    ["long-term", 1_250],
    ["vacation", 140],
  ]);

  for (const [bankIndex, bank] of data.savingsBanks.entries()) {
    for (const [monthIndex, month] of months.entries()) {
      if (monthIndex % 2 !== 0 && monthIndex !== months.length - 1) continue;
      const lastDay = daysInMonth(`${month}-01`);
      const endOfMonth = dateOnDay(month, lastDay, asOfDate);
      const value =
        (baseBalances.get(bank.key) ?? 0) +
        monthIndex * (increments.get(bank.key) ?? 0) +
        rng.int(
          -Math.max(20, Math.floor((increments.get(bank.key) ?? 0) / 2)),
          Math.max(20, Math.floor((increments.get(bank.key) ?? 0) / 2)),
        );
      data.savingsEntries.push({
        bankKey: bank.key,
        date: endOfMonth,
        amount: roundMoney(Math.max(0, value)),
        currency: bank.currency,
        note:
          monthIndex === 0
            ? "Opening balance"
            : bankIndex === 0
              ? "Monthly balance snapshot"
              : rng.pick([
                  "Contribution",
                  "End of month",
                  "Balance review",
                ] as const),
      });
    }
  }

  data.savingsSettings = {
    displayCurrency: "ILS",
    manualUsdIlsRate: 3.65,
  };
  data.exchangeRate = {
    pair: "USD_ILS",
    base: "USD",
    quote: "ILS",
    rate: 3.65,
    rateDate: asOfDate,
    source: "dev-seed",
  };
}

function validateSeedData(data: SeedData) {
  const expenseKeys = new Set(data.expenses.map((row) => row.key));
  const incomingKeys = new Set(data.incomings.map((row) => row.key));
  for (const link of data.paybackLinks) {
    if (
      !expenseKeys.has(link.expenseKey) ||
      !incomingKeys.has(link.incomingKey)
    ) {
      throw new Error("Seed payback link references a missing ledger row");
    }
    if (link.allocatedAmount <= 0) {
      throw new Error("Seed payback allocation must be positive");
    }
  }
  for (const row of data.expenses) {
    if (row.effectiveAmountMode === "auto" && row.effectiveAmount < 0) {
      throw new Error("Seed expense effective amount cannot be negative");
    }
  }
  for (const row of data.incomings) {
    if (row.effectiveAmountMode === "auto" && row.effectiveAmount < 0) {
      throw new Error("Seed incoming effective amount cannot be negative");
    }
  }
}

export function generateSeedData(
  options: {
    profile?: SeedProfile;
    seed?: number;
    asOfDate?: string;
  } = {},
): SeedData {
  const profile = options.profile ?? "realistic";
  const seed = Number.isFinite(options.seed)
    ? Math.trunc(options.seed!)
    : 20_260_818;
  const asOfDate = options.asOfDate ?? "2026-08-18";
  parseDate(asOfDate);

  const config =
    profile === "stress"
      ? {
          months: 60,
          expensesPerMonth: 250,
          expenseVariance: 24,
          bulkGroupsPerMonth: 5,
          bigPurchases: 32,
          transfers: 18,
          oneTimeIncomings: 24,
          paybackGroups: 520,
        }
      : {
          months: 36,
          expensesPerMonth: 140,
          expenseVariance: 16,
          bulkGroupsPerMonth: 2,
          bigPurchases: 20,
          transfers: 12,
          oneTimeIncomings: 14,
          paybackGroups: 220,
        };

  const rng = makeRng(seed);
  const startMonth = addMonths(monthStart(asOfDate), -config.months + 1);
  const months = monthKeysBetween(startMonth, asOfDate);
  const data: SeedData = {
    profile,
    seed,
    asOfDate,
    expenses: [],
    incomings: [],
    paybackLinks: [],
    options: [],
    recurrings: buildRecurringRows(),
    notes: [],
    tables: [],
    savingsBanks: [],
    savingsEntries: [],
    savingsSettings: { displayCurrency: "ILS", manualUsdIlsRate: 3.65 },
    exchangeRate: {
      pair: "USD_ILS",
      base: "USD",
      quote: "ILS",
      rate: 3.65,
      rateDate: asOfDate,
      source: "dev-seed",
    },
  };

  addHistoricalRecurringRows(data, months, asOfDate, rng);
  addVariableExpenses(
    data,
    months,
    asOfDate,
    rng,
    config.expensesPerMonth,
    config.expenseVariance,
  );
  addBulkExpenseGroups(data, months, asOfDate, rng, config.bulkGroupsPerMonth);
  addBigPurchases(data, months, asOfDate, rng, config.bigPurchases);
  addMultiMonthBills(data, months, asOfDate, rng);
  addTransfers(data, months, asOfDate, rng, config.transfers);
  addRegularIncomings(data, months, asOfDate, rng);
  addGroupedIncomings(data, months, asOfDate, rng);
  addOneTimeIncomings(data, months, asOfDate, rng, config.oneTimeIncomings);
  addPaybackGroups(data, months, asOfDate, rng, config.paybackGroups);
  addOptions(data);
  addNotepad(data, profile);
  addSavings(data, months, asOfDate, rng);
  validateSeedData(data);
  return data;
}
