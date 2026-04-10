export type EntryType = "expense" | "income";
export type AuthMode = "login" | "signup";

export type Entry = {
  id: string;
  type: EntryType;
  name: string;
  amount: number;
  category: string | null;
  subcategory: string | null;
  date: string;
  account: string | null;
  notes: string | null;
  entryKind: string | null;
  counterparty: string | null;
  comments: string | null;
  entryCode: string;
  allocationMonths: string[];
  linkedRecurringRuleId: string | null;
  recurringOccurrenceKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Profile = {
  username: string;
  fullName: string;
  email: string | null;
  age: number | null;
  pictureUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = {
  username: string;
  profile: Profile;
};

export type CategoryBreakdownItem = {
  category: string;
  total: number;
  count: number;
};

export type DashboardResponse = {
  month: string;
  totals: {
    income: number;
    expenses: number;
    net: number;
  };
  counts: {
    income: number;
    expenses: number;
  };
  entries: Entry[];
  recentEntries: Entry[];
  expenseEntries: Entry[];
  incomeEntries: Entry[];
  categoryBreakdown: {
    expense: CategoryBreakdownItem[];
    income: CategoryBreakdownItem[];
  };
  recurringRules: RecurringRule[];
  evenUpRecords: EvenUpRecord[];
  importantDates: ImportantDate[];
  recurringSummary: {
    activeCount: number;
    upcomingCount: number;
    generatedThisMonth: number;
    nextRuleName: string | null;
    nextTriggerDate: string | null;
  };
  evenUpSummary: {
    openCount: number;
    outstanding: number;
  };
};

export type ReferenceData = {
  accounts: string[];
  categories: {
    expense: string[];
    income: string[];
  };
  subcategories: {
    expense: Record<string, string[]>;
    income: Record<string, string[]>;
  };
  expenseKinds: string[];
  counterparties: {
    expense: string[];
    income: string[];
  };
};

export type DefaultAccount = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

export type DefaultSubcategory = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

export type DefaultCategory = {
  id: string;
  type: EntryType;
  name: string;
  subcategories: DefaultSubcategory[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

export type DefaultsOverview = {
  accounts: DefaultAccount[];
  categories: {
    expense: DefaultCategory[];
    income: DefaultCategory[];
  };
  expenseKinds: DefaultExpenseKind[];
  importantDates: ImportantDate[];
  bills: BillReference[];
  notepad: NotepadDocument;
};

export type DefaultExpenseKind = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
};

export type ImportantDate = {
  id: string;
  name: string;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntil: number;
  isPast: boolean;
};

export type BillReference = {
  id: string;
  name: string;
  customerNumber: string | null;
  consumerNumber: string | null;
  meterNumber: string | null;
  contractAccount: string | null;
  identityNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotepadDocument = {
  content: string;
  updatedAt: string | null;
};

export type RecurringRule = {
  id: string;
  type: EntryType;
  status: string;
  name: string;
  amount: number;
  frequency: string;
  intervalMonths: number;
  dayOfMonth: number;
  account: string | null;
  category: string | null;
  entryKind: string | null;
  counterparty: string | null;
  notes: string | null;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt: string | null;
  nextTriggerDate: string | null;
  triggeredCount: number;
};

export type EvenUpRecord = {
  id: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  from: string | null;
  to: string | null;
  paid: number;
  getBackAmount: number;
  halfGetBackAmount: number;
  giveBackAmount: number;
  halfGiveBackAmount: number;
  amount: number;
  remaining: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurringRunResult = {
  createdCount: number;
  createdEntries: Entry[];
  triggeredRuleIds: string[];
};

export type Draft = {
  type: EntryType;
  name: string;
  amount: string;
  category: string;
  subcategory: string;
  date: string;
  account: string;
  notes: string;
  entryKind: string;
  counterparty: string;
  comments: string;
  allocationMonthsText: string;
};

export type AuthForm = {
  username: string;
  password: string;
  fullName: string;
  email: string;
  age: string;
  pictureUrl: string;
};

export type ProfileForm = {
  fullName: string;
  email: string;
  age: string;
  pictureUrl: string;
  currentPassword: string;
  newPassword: string;
};

export type RecurringRuleDraft = {
  id: string | null;
  type: EntryType;
  status: string;
  name: string;
  amount: string;
  frequency: string;
  dayOfMonth: string;
  account: string;
  category: string;
  entryKind: string;
  counterparty: string;
  notes: string;
  startDate: string;
};

export type EvenUpDraft = {
  id: string | null;
  status: string;
  startDate: string;
  endDate: string;
  paid: string;
  from: string;
  to: string;
  notes: string;
};
