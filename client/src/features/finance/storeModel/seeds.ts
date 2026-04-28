import type { EntryType } from "../types";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_KINDS,
  DEFAULT_IMPORTANT_DATES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INCOME_SUBCATEGORIES,
  DEFAULT_RECURRING_TEMPLATES,
  DEFAULT_SUBCATEGORIES,
  type DefaultImportantDateTemplate,
  type DefaultRecurringTemplate,
} from "../defaultSeeds";
import { buildCurrentMonthStartDate, slugifyIdPart } from "./core";
import {
  SEED_TIMESTAMP,
  type StoredAccount,
  type StoredCategory,
  type StoredExpenseKind,
  type StoredImportantDate,
  type StoredRecurringRule,
} from "./storeTypes";

export function createSeedAccount(name: string): StoredAccount {
  const slug = slugifyIdPart(name);

  return {
    id: `account-${slug}`,
    name,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function createSeedExpenseKind(name: string): StoredExpenseKind {
  return {
    id: `expense-kind-${slugifyIdPart(name)}`,
    name,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function createSeedCategory(
  type: EntryType,
  name: string,
  subcategoryNames: string[] = [],
): StoredCategory {
  const categorySlug = slugifyIdPart(name);

  return {
    id: `${type}-category-${categorySlug}`,
    type,
    name,
    subcategories: subcategoryNames.map((subcategoryName) => ({
      id: `${type}-subcategory-${categorySlug}-${slugifyIdPart(subcategoryName)}`,
      name: subcategoryName,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    })),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function createSeedRecurringRule(
  template: DefaultRecurringTemplate,
): StoredRecurringRule {
  return {
    id: `recurring-${slugifyIdPart(template.name)}`,
    type: template.type,
    status: template.status,
    name: template.name,
    amount: Number(template.amount),
    frequency: template.frequency,
    dayOfMonth: template.dayOfMonth,
    account: template.account,
    category: template.category,
    entryKind: template.entryKind,
    counterparty: template.counterparty,
    notes: template.notes || null,
    startDate: buildCurrentMonthStartDate(),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function createSeedImportantDate(
  template: DefaultImportantDateTemplate,
): StoredImportantDate {
  return {
    id: `date-${slugifyIdPart(template.name)}`,
    name: template.name,
    date: template.date,
    notes: template.notes,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function createSeedDefaults() {
  return {
    accounts: DEFAULT_ACCOUNTS.map((name) => createSeedAccount(name)),
    categories: {
      expense: DEFAULT_EXPENSE_CATEGORIES.map((name) =>
        createSeedCategory("expense", name, DEFAULT_SUBCATEGORIES[name] ?? []),
      ),
      income: DEFAULT_INCOME_CATEGORIES.map((name) =>
        createSeedCategory(
          "income",
          name,
          DEFAULT_INCOME_SUBCATEGORIES[name] ?? [],
        ),
      ),
    },
    expenseKinds: DEFAULT_EXPENSE_KINDS.map((name) =>
      createSeedExpenseKind(name),
    ),
    hiddenSeedExpenseKinds: [],
  };
}

export function createSeedRecurringRules() {
  return DEFAULT_RECURRING_TEMPLATES.map((template) =>
    createSeedRecurringRule(template),
  );
}

export function createSeedImportantDates() {
  return DEFAULT_IMPORTANT_DATES.map((template) =>
    createSeedImportantDate(template),
  );
}
