import type { DefaultCategory, DefaultsOverview, EntryType } from "../types";
import { buildImportantDate } from "./dashboard";
import type { StoredCategory, UserStore } from "./storeTypes";

export function getAccountUsageCount(userStore: UserStore, accountName: string) {
  return userStore.entries.filter((entry) => entry.account === accountName).length;
}

export function getCategoryUsageCount(
  userStore: UserStore,
  type: EntryType,
  categoryName: string,
) {
  return userStore.entries.filter(
    (entry) => entry.type === type && entry.category === categoryName,
  ).length;
}

export function getSubcategoryUsageCount(
  userStore: UserStore,
  type: EntryType,
  categoryName: string,
  subcategoryName: string,
) {
  return userStore.entries.filter(
    (entry) =>
      entry.type === type &&
      entry.category === categoryName &&
      entry.subcategory === subcategoryName,
  ).length;
}

export function getExpenseKindUsageCount(userStore: UserStore, entryKindName: string) {
  return userStore.entries.filter(
    (entry) => entry.type === "expense" && entry.entryKind === entryKindName,
  ).length;
}

export function buildDefaultCategoryResponse(
  userStore: UserStore,
  category: StoredCategory,
): DefaultCategory {
  return {
    ...category,
    usageCount: getCategoryUsageCount(userStore, category.type, category.name),
    subcategories: category.subcategories.map((subcategory) => ({
      ...subcategory,
      usageCount: getSubcategoryUsageCount(
        userStore,
        category.type,
        category.name,
        subcategory.name,
      ),
    })),
  };
}

export function buildDefaultsOverview(userStore: UserStore): DefaultsOverview {
  return {
    accounts: userStore.defaults.accounts.map((account) => ({
      ...account,
      usageCount: getAccountUsageCount(userStore, account.name),
    })),
    categories: {
      expense: userStore.defaults.categories.expense.map((category) => ({
        ...category,
        usageCount: getCategoryUsageCount(userStore, "expense", category.name),
        subcategories: category.subcategories.map((subcategory) => ({
          ...subcategory,
          usageCount: getSubcategoryUsageCount(
            userStore,
            "expense",
            category.name,
            subcategory.name,
          ),
        })),
      })),
      income: userStore.defaults.categories.income.map((category) => ({
        ...category,
        usageCount: getCategoryUsageCount(userStore, "income", category.name),
        subcategories: category.subcategories.map((subcategory) => ({
          ...subcategory,
          usageCount: getSubcategoryUsageCount(
            userStore,
            "income",
            category.name,
            subcategory.name,
          ),
        })),
      })),
    },
    expenseKinds: userStore.defaults.expenseKinds.map((kind) => ({
      ...kind,
      usageCount: getExpenseKindUsageCount(userStore, kind.name),
    })),
    importantDates: [...userStore.importantDates]
      .map((item) => buildImportantDate(item))
      .sort((left, right) => Math.abs(left.daysUntil) - Math.abs(right.daysUntil)),
    bills: [...userStore.bills].sort((left, right) => left.name.localeCompare(right.name)),
    notepad: userStore.notepad,
  };
}
