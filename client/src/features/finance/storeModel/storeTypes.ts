import type {
  AuthUser,
  BillReference,
  DefaultAccount,
  DefaultCategory,
  DefaultExpenseKind,
  NotepadDocument,
  EvenUpRecord,
  ImportantDate,
  Profile,
  RecurringRule,
} from "../types";

export type UserStore = {
  profile: Profile;
  metadata: Record<string, never>;
  entries: import("../types").Entry[];
  defaults: {
    accounts: StoredAccount[];
    categories: {
      expense: StoredCategory[];
      income: StoredCategory[];
    };
    expenseKinds: StoredExpenseKind[];
    hiddenSeedExpenseKinds: string[];
  };
  recurringRules: StoredRecurringRule[];
  importantDates: StoredImportantDate[];
  bills: StoredBillReference[];
  notepad: StoredNotepadDocument;
  evenUpRecords: StoredEvenUpRecord[];
};

export type StoredAccount = Omit<DefaultAccount, "usageCount">;
export type StoredExpenseKind = Omit<DefaultExpenseKind, "usageCount">;
export type StoredSubcategory = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
export type StoredCategory = Omit<DefaultCategory, "usageCount" | "subcategories"> & {
  subcategories: StoredSubcategory[];
};
export type StoredRecurringRule = Omit<
  RecurringRule,
  "intervalMonths" | "lastTriggeredAt" | "nextTriggerDate" | "triggeredCount"
>;
export type StoredImportantDate = Omit<ImportantDate, "daysUntil" | "isPast">;
export type StoredBillReference = BillReference;
export type StoredNotepadDocument = NotepadDocument;
export type StoredEvenUpRecord = Omit<
  EvenUpRecord,
  "getBackAmount" | "halfGetBackAmount" | "giveBackAmount" | "halfGiveBackAmount" | "amount" | "remaining"
>;

export const SEED_TIMESTAMP = "2026-04-05T00:00:00.000Z";

export type AuthPayload = AuthUser;
