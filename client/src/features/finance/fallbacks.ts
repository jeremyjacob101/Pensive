import type {
  DefaultsOverview,
  EvenUpDraft,
  EntryType,
  ProfileForm,
  ReferenceData,
  RecurringRuleDraft,
  AuthUser,
  Draft,
} from "./types";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_COUNTERPARTY_SUGGESTIONS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_KINDS,
  DEFAULT_IMPORTANT_DATES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INCOME_SUBCATEGORIES,
  DEFAULT_SUBCATEGORIES,
} from "./defaultSeeds";

function toFallbackId(prefix: string, value: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export const fallbackReferenceData: ReferenceData = {
  accounts: [...DEFAULT_ACCOUNTS],
  categories: {
    expense: [...DEFAULT_EXPENSE_CATEGORIES],
    income: [...DEFAULT_INCOME_CATEGORIES],
  },
  subcategories: {
    expense: { ...DEFAULT_SUBCATEGORIES },
    income: { ...DEFAULT_INCOME_SUBCATEGORIES },
  },
  expenseKinds: [...DEFAULT_EXPENSE_KINDS],
  counterparties: {
    expense: [...DEFAULT_COUNTERPARTY_SUGGESTIONS.expense],
    income: [...DEFAULT_COUNTERPARTY_SUGGESTIONS.income],
  },
};

export const fallbackDefaultsOverview: DefaultsOverview = {
  accounts: fallbackReferenceData.accounts.map((name) => ({
    id: toFallbackId("fallback-account", name),
    name,
    createdAt: "",
    updatedAt: "",
    usageCount: 0,
  })),
  categories: {
    expense: fallbackReferenceData.categories.expense.map((name) => ({
      id: toFallbackId("fallback-expense", name),
      type: "expense",
      name,
      createdAt: "",
      updatedAt: "",
      usageCount: 0,
      subcategories: (
        fallbackReferenceData.subcategories.expense[name] ?? []
      ).map((subcategory) => ({
        id: toFallbackId("fallback-expense-sub", subcategory),
        name: subcategory,
        createdAt: "",
        updatedAt: "",
        usageCount: 0,
      })),
    })),
    income: fallbackReferenceData.categories.income.map((name) => ({
      id: toFallbackId("fallback-income", name),
      type: "income",
      name,
      createdAt: "",
      updatedAt: "",
      usageCount: 0,
      subcategories: (
        fallbackReferenceData.subcategories.income[name] ?? []
      ).map((subcategory) => ({
        id: toFallbackId("fallback-income-sub", subcategory),
        name: subcategory,
        createdAt: "",
        updatedAt: "",
        usageCount: 0,
      })),
    })),
  },
  expenseKinds: fallbackReferenceData.expenseKinds.map((name) => ({
    id: toFallbackId("fallback-kind", name),
    name,
    createdAt: "",
    updatedAt: "",
    usageCount: 0,
  })),
  importantDates: DEFAULT_IMPORTANT_DATES.map((item) => ({
    id: toFallbackId("fallback-date", item.name),
    name: item.name,
    date: item.date,
    notes: item.notes,
    createdAt: "",
    updatedAt: "",
    daysUntil: 0,
    isPast: false,
  })),
  bills: [],
  notepad: {
    content: "",
    updatedAt: null,
  },
};

export function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function getDefaultCategory(
  type: EntryType,
  referenceData: ReferenceData,
) {
  return (
    referenceData.categories[type][0] ??
    fallbackReferenceData.categories[type][0]
  );
}

export function getDefaultAccount(referenceData: ReferenceData) {
  return referenceData.accounts[0] ?? fallbackReferenceData.accounts[0];
}

export function getInitialDraft(
  type: EntryType,
  referenceData: ReferenceData,
): Draft {
  const today = new Date();
  const monthLabel = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    type,
    name: "",
    amount: "",
    category: getDefaultCategory(type, referenceData),
    subcategory: "",
    date: new Date().toISOString().slice(0, 10),
    account: getDefaultAccount(referenceData),
    notes: "",
    entryKind:
      type === "expense" ? (referenceData.expenseKinds[0] ?? "Regular") : "",
    counterparty: "",
    comments: "",
    allocationMonthsText: monthLabel,
  };
}

export function getInitialRecurringRuleDraft(
  referenceData: ReferenceData,
): RecurringRuleDraft {
  return {
    id: null,
    type: "expense",
    status: "add",
    name: "",
    amount: "",
    frequency: "Monthly",
    dayOfMonth: String(new Date().getDate()),
    account: getDefaultAccount(referenceData),
    category: referenceData.categories.expense[0] ?? "",
    entryKind: referenceData.expenseKinds[0] ?? "Regular",
    counterparty: "",
    notes: "",
    startDate: new Date().toISOString().slice(0, 10),
  };
}

export function getInitialEvenUpDraft(): EvenUpDraft {
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: null,
    status: "Open",
    startDate: today,
    endDate: today,
    paid: "0",
    from: "",
    to: "",
    notes: "",
  };
}

export function buildProfileForm(user: AuthUser | null): ProfileForm {
  return {
    fullName: user?.profile.fullName ?? "",
    email: user?.profile.email ?? "",
    age:
      user?.profile.age === null || user?.profile.age === undefined
        ? ""
        : String(user.profile.age),
    pictureUrl: user?.profile.pictureUrl ?? "",
    currentPassword: "",
    newPassword: "",
  };
}
