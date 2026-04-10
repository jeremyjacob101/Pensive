import {
  buildDefaultCategoryResponse,
  cleanRequiredString,
  getAccountUsageCount,
  getSubcategoryUsageCount,
  normalizeType,
  uniqueSortedStrings,
  type StoredAccount,
  type StoredCategory,
  type StoredSubcategory,
  type UserStore,
} from "../../features/finance/storeModel";
import type {
  DefaultAccount,
  DefaultSubcategory,
} from "../../features/finance/types";
import { withUserStoreTransaction } from "./store";

function findAccountIndex(userStore: UserStore, accountId: string) {
  return userStore.defaults.accounts.findIndex((account) => account.id === accountId);
}

function findCategoryIndex(
  userStore: UserStore,
  type: "expense" | "income",
  categoryId: string,
) {
  return userStore.defaults.categories[type].findIndex((category) => category.id === categoryId);
}

function findSubcategoryIndex(category: StoredCategory, subcategoryId: string) {
  return category.subcategories.findIndex((subcategory) => subcategory.id === subcategoryId);
}

export async function createAccountRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const name = cleanRequiredString(body.name);

    if (!name) {
      throw new Error("name is required");
    }

    const duplicate = store.defaults.accounts.find(
      (account) => account.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("account already exists");
    }

    const now = new Date().toISOString();
    const account: StoredAccount = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    store.defaults.accounts.push(account);
    store.defaults.accounts.sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    return {
      ...account,
      usageCount: getAccountUsageCount(store, account.name),
    } satisfies DefaultAccount;
  });
}

export async function updateAccountRecord(
  accountId: string,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const accountIndex = findAccountIndex(store, accountId);

    if (accountIndex === -1) {
      throw new Error("account not found");
    }

    const nextName = cleanRequiredString(body.name);

    if (!nextName) {
      throw new Error("name is required");
    }

    const duplicate = store.defaults.accounts.find(
      (account, index) =>
        index !== accountIndex &&
        account.name.toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("account already exists");
    }

    const existingAccount = store.defaults.accounts[accountIndex];
    const previousName = existingAccount.name;
    const now = new Date().toISOString();

    store.defaults.accounts[accountIndex] = {
      ...existingAccount,
      name: nextName,
      updatedAt: now,
    };

    store.entries = store.entries.map((entry) =>
      entry.account === previousName
        ? {
            ...entry,
            account: nextName,
            updatedAt: now,
          }
        : entry,
    );
    store.recurringRules = store.recurringRules.map((rule) =>
      rule.account === previousName
        ? {
            ...rule,
            account: nextName,
            updatedAt: now,
          }
        : rule,
    );

    store.defaults.accounts.sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    const updated = store.defaults.accounts.find(
      (account) => account.id === accountId,
    );

    if (!updated) {
      throw new Error("account not found");
    }

    return {
      ...updated,
      usageCount: getAccountUsageCount(store, nextName),
    } satisfies DefaultAccount;
  });
}

export async function deleteAccountRecord(accountId: string, clearEntries: boolean) {
  return withUserStoreTransaction((store) => {
    const accountIndex = findAccountIndex(store, accountId);

    if (accountIndex === -1) {
      throw new Error("account not found");
    }

    const [deletedAccount] = store.defaults.accounts.splice(accountIndex, 1);

    if (clearEntries) {
      const now = new Date().toISOString();
      store.entries = store.entries.map((entry) =>
        entry.account === deletedAccount.name
          ? {
              ...entry,
              account: null,
              updatedAt: now,
            }
          : entry,
      );
      store.recurringRules = store.recurringRules.map((rule) =>
        rule.account === deletedAccount.name
          ? {
              ...rule,
              account: null,
              updatedAt: now,
            }
          : rule,
      );
    }

    return {
      deleted: true,
      clearedEntries: clearEntries,
      account: deletedAccount,
    };
  });
}

export async function createCategoryRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const type = normalizeType(body.type, "expense");
    const name = cleanRequiredString(body.name);

    if (!name) {
      throw new Error("name is required");
    }

    const duplicate = store.defaults.categories[type].find(
      (category) => category.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error(`${type} category already exists`);
    }

    const subcategoryNames = Array.isArray(body.subcategories)
      ? uniqueSortedStrings(
          body.subcategories.map((value) => cleanRequiredString(value)),
        )
      : [];
    const now = new Date().toISOString();
    const category: StoredCategory = {
      id: crypto.randomUUID(),
      type,
      name,
      subcategories: subcategoryNames.map((subcategoryName) => ({
        id: crypto.randomUUID(),
        name: subcategoryName,
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };

    store.defaults.categories[type].push(category);
    store.defaults.categories[type].sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    return buildDefaultCategoryResponse(store, category);
  });
}

export async function updateCategoryRecord(
  categoryId: string,
  searchParams: URLSearchParams,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const currentType =
      searchParams.get("type") === "income" ? "income" : "expense";
    const categoryIndex = findCategoryIndex(store, currentType, categoryId);

    if (categoryIndex === -1) {
      throw new Error("category not found");
    }

    const existingCategory =
      store.defaults.categories[currentType][categoryIndex];
    const nextType = body.type
      ? normalizeType(body.type, existingCategory.type)
      : existingCategory.type;
    const nextName = cleanRequiredString(body.name ?? existingCategory.name);

    if (!nextName) {
      throw new Error("name is required");
    }

    const duplicate = store.defaults.categories[nextType].find(
      (category) =>
        category.id !== existingCategory.id &&
        category.name.toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error(`${nextType} category already exists`);
    }

    const now = new Date().toISOString();
    const previousType = existingCategory.type;
    const previousName = existingCategory.name;
    const nextCategory: StoredCategory = {
      ...existingCategory,
      type: nextType,
      name: nextName,
      updatedAt: now,
    };

    store.defaults.categories[currentType].splice(categoryIndex, 1);
    store.defaults.categories[nextType].push(nextCategory);
    store.defaults.categories.expense.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    store.defaults.categories.income.sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    store.entries = store.entries.map((entry) => {
      if (entry.type !== previousType || entry.category !== previousName) {
        return entry;
      }

      return {
        ...entry,
        type: nextType,
        category: nextName,
        updatedAt: now,
      };
    });
    store.recurringRules = store.recurringRules.map((rule) => {
      if (rule.category !== previousName) {
        return rule;
      }

      return {
        ...rule,
        category: nextName,
        updatedAt: now,
      };
    });

    return buildDefaultCategoryResponse(store, nextCategory);
  });
}

export async function deleteCategoryRecord(
  categoryId: string,
  searchParams: URLSearchParams,
) {
  return withUserStoreTransaction((store) => {
    const type = searchParams.get("type") === "income" ? "income" : "expense";
    const categoryIndex = findCategoryIndex(store, type, categoryId);

    if (categoryIndex === -1) {
      throw new Error("category not found");
    }

    const [deletedCategory] = store.defaults.categories[type].splice(
      categoryIndex,
      1,
    );
    const clearFromEntries = searchParams.get("clearEntries") === "true";

    if (clearFromEntries) {
      const now = new Date().toISOString();
      store.entries = store.entries.map((entry) => {
        if (entry.type !== type || entry.category !== deletedCategory.name) {
          return entry;
        }

        return {
          ...entry,
          category: null,
          subcategory: null,
          updatedAt: now,
        };
      });
      store.recurringRules = store.recurringRules.map((rule) =>
        rule.category === deletedCategory.name
          ? {
              ...rule,
              category: null,
              updatedAt: now,
            }
          : rule,
      );
    }

    return {
      deleted: true,
      clearedEntries: clearFromEntries,
      category: deletedCategory,
    };
  });
}

export async function createSubcategoryRecord(
  categoryId: string,
  searchParams: URLSearchParams,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const type = searchParams.get("type") === "income" ? "income" : "expense";
    const categoryIndex = findCategoryIndex(store, type, categoryId);

    if (categoryIndex === -1) {
      throw new Error("category not found");
    }

    const category = store.defaults.categories[type][categoryIndex];
    const name = cleanRequiredString(body.name);

    if (!name) {
      throw new Error("name is required");
    }

    const duplicate = category.subcategories.find(
      (subcategory) => subcategory.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("subcategory already exists");
    }

    const now = new Date().toISOString();
    const subcategory: StoredSubcategory = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    category.subcategories.push(subcategory);
    category.subcategories.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    category.updatedAt = now;

    return {
      ...subcategory,
      usageCount: getSubcategoryUsageCount(store, type, category.name, name),
    } satisfies DefaultSubcategory;
  });
}

export async function updateSubcategoryRecord(
  categoryId: string,
  subcategoryId: string,
  searchParams: URLSearchParams,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const type = searchParams.get("type") === "income" ? "income" : "expense";
    const categoryIndex = findCategoryIndex(store, type, categoryId);

    if (categoryIndex === -1) {
      throw new Error("category not found");
    }

    const category = store.defaults.categories[type][categoryIndex];
    const subcategoryIndex = findSubcategoryIndex(category, subcategoryId);

    if (subcategoryIndex === -1) {
      throw new Error("subcategory not found");
    }

    const nextName = cleanRequiredString(body.name);

    if (!nextName) {
      throw new Error("name is required");
    }

    const duplicate = category.subcategories.find(
      (subcategory, index) =>
        index !== subcategoryIndex &&
        subcategory.name.toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("subcategory already exists");
    }

    const now = new Date().toISOString();
    const existingSubcategory = category.subcategories[subcategoryIndex];
    const previousName = existingSubcategory.name;

    category.subcategories[subcategoryIndex] = {
      ...existingSubcategory,
      name: nextName,
      updatedAt: now,
    };
    category.subcategories.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    category.updatedAt = now;

    store.entries = store.entries.map((entry) => {
      if (
        entry.type !== type ||
        entry.category !== category.name ||
        entry.subcategory !== previousName
      ) {
        return entry;
      }

      return {
        ...entry,
        subcategory: nextName,
        updatedAt: now,
      };
    });

    const updated = category.subcategories.find(
      (subcategory) => subcategory.id === subcategoryId,
    );

    if (!updated) {
      throw new Error("subcategory not found");
    }

    return {
      ...updated,
      usageCount: getSubcategoryUsageCount(
        store,
        type,
        category.name,
        nextName,
      ),
    } satisfies DefaultSubcategory;
  });
}

export async function deleteSubcategoryRecord(
  categoryId: string,
  subcategoryId: string,
  searchParams: URLSearchParams,
) {
  return withUserStoreTransaction((store) => {
    const type = searchParams.get("type") === "income" ? "income" : "expense";
    const categoryIndex = findCategoryIndex(store, type, categoryId);

    if (categoryIndex === -1) {
      throw new Error("category not found");
    }

    const category = store.defaults.categories[type][categoryIndex];
    const subcategoryIndex = findSubcategoryIndex(category, subcategoryId);

    if (subcategoryIndex === -1) {
      throw new Error("subcategory not found");
    }

    const [deletedSubcategory] = category.subcategories.splice(
      subcategoryIndex,
      1,
    );
    const clearFromEntries = searchParams.get("clearEntries") === "true";
    const now = new Date().toISOString();
    category.updatedAt = now;

    if (clearFromEntries) {
      store.entries = store.entries.map((entry) => {
        if (
          entry.type !== type ||
          entry.category !== category.name ||
          entry.subcategory !== deletedSubcategory.name
        ) {
          return entry;
        }

        return {
          ...entry,
          subcategory: null,
          updatedAt: now,
        };
      });
    }

    return {
      deleted: true,
      clearedEntries: clearFromEntries,
      subcategory: deletedSubcategory,
    };
  });
}
