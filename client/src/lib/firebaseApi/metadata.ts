import {
  buildDefaultsOverview,
  cleanOptionalString,
  cleanRequiredString,
  getExpenseKindUsageCount,
  type StoredExpenseKind,
  type StoredImportantDate,
  type UserStore,
} from "../../features/finance/storeModel";
import type {
  DefaultExpenseKind,
  ImportantDate,
} from "../../features/finance/types";
import { DEFAULT_EXPENSE_KINDS } from "../../features/finance/defaultSeeds";
import { withUserStoreTransaction } from "./store";

function findExpenseKindIndex(userStore: UserStore, kindId: string) {
  return userStore.defaults.expenseKinds.findIndex(
    (kind) => kind.id === kindId,
  );
}

function findImportantDateIndex(userStore: UserStore, dateId: string) {
  return userStore.importantDates.findIndex((item) => item.id === dateId);
}

const SEEDED_EXPENSE_KIND_NAMES = new Set(
  DEFAULT_EXPENSE_KINDS.map((name) => name.toLowerCase()),
);

function removeHiddenSeedExpenseKind(userStore: UserStore, kindName: string) {
  userStore.defaults.hiddenSeedExpenseKinds =
    userStore.defaults.hiddenSeedExpenseKinds.filter(
      (hiddenName) => hiddenName !== kindName.toLowerCase(),
    );
}

export async function createExpenseKindRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const name = cleanRequiredString(body.name);

    if (!name) {
      throw new Error("name is required");
    }

    const duplicate = store.defaults.expenseKinds.find(
      (kind) => kind.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("expense kind already exists");
    }

    const now = new Date().toISOString();
    const kind: StoredExpenseKind = {
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    store.defaults.expenseKinds.push(kind);
    store.defaults.expenseKinds.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    removeHiddenSeedExpenseKind(store, kind.name);

    return {
      ...kind,
      usageCount: getExpenseKindUsageCount(store, kind.name),
    } satisfies DefaultExpenseKind;
  });
}

export async function updateExpenseKindRecord(
  kindId: string,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const kindIndex = findExpenseKindIndex(store, kindId);

    if (kindIndex === -1) {
      throw new Error("expense kind not found");
    }

    const nextName = cleanRequiredString(body.name);

    if (!nextName) {
      throw new Error("name is required");
    }

    const duplicate = store.defaults.expenseKinds.find(
      (kind, index) =>
        index !== kindIndex &&
        kind.name.toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("expense kind already exists");
    }

    const now = new Date().toISOString();
    const existingKind = store.defaults.expenseKinds[kindIndex];
    const previousName = existingKind.name;

    store.defaults.expenseKinds[kindIndex] = {
      ...existingKind,
      name: nextName,
      updatedAt: now,
    };
    store.defaults.expenseKinds.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    removeHiddenSeedExpenseKind(store, previousName);
    removeHiddenSeedExpenseKind(store, nextName);
    store.entries = store.entries.map((entry) =>
      entry.type === "expense" && entry.entryKind === previousName
        ? {
            ...entry,
            entryKind: nextName,
            updatedAt: now,
          }
        : entry,
    );
    store.recurringRules = store.recurringRules.map((rule) =>
      rule.entryKind === previousName
        ? {
            ...rule,
            entryKind: nextName,
            updatedAt: now,
          }
        : rule,
    );

    const updated = store.defaults.expenseKinds.find(
      (kind) => kind.id === kindId,
    );

    if (!updated) {
      throw new Error("expense kind not found");
    }

    return {
      ...updated,
      usageCount: getExpenseKindUsageCount(store, updated.name),
    } satisfies DefaultExpenseKind;
  });
}

export async function deleteExpenseKindRecord(
  kindId: string,
  clearEntries: boolean,
) {
  return withUserStoreTransaction((store) => {
    const kindIndex = findExpenseKindIndex(store, kindId);

    if (kindIndex === -1) {
      throw new Error("expense kind not found");
    }

    const [deletedKind] = store.defaults.expenseKinds.splice(kindIndex, 1);

    if (SEEDED_EXPENSE_KIND_NAMES.has(deletedKind.name.toLowerCase())) {
      store.defaults.hiddenSeedExpenseKinds = [
        ...new Set([
          ...store.defaults.hiddenSeedExpenseKinds,
          deletedKind.name.toLowerCase(),
        ]),
      ].sort((left, right) => left.localeCompare(right));
    }

    if (clearEntries) {
      const now = new Date().toISOString();
      store.entries = store.entries.map((entry) =>
        entry.type === "expense" && entry.entryKind === deletedKind.name
          ? {
              ...entry,
              entryKind: null,
              updatedAt: now,
            }
          : entry,
      );
      store.recurringRules = store.recurringRules.map((rule) =>
        rule.entryKind === deletedKind.name
          ? {
              ...rule,
              entryKind: null,
              updatedAt: now,
            }
          : rule,
      );
    }

    return {
      deleted: true,
      clearedEntries: clearEntries,
      expenseKind: deletedKind,
    };
  });
}

export async function createImportantDateRecord(body: Record<string, unknown>) {
  return withUserStoreTransaction((store) => {
    const name = cleanRequiredString(body.name);
    const date = body.date ? String(body.date) : "";

    if (!name || !date) {
      throw new Error("name and date are required");
    }

    const duplicate = store.importantDates.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("important date already exists");
    }

    const now = new Date().toISOString();
    const item: StoredImportantDate = {
      id: crypto.randomUUID(),
      name,
      date,
      notes: cleanOptionalString(body.notes),
      createdAt: now,
      updatedAt: now,
    };

    store.importantDates.push(item);

    return buildDefaultsOverview(store).importantDates.find(
      (current) => current.id === item.id,
    ) as ImportantDate;
  });
}

export async function updateImportantDateRecord(
  dateId: string,
  body: Record<string, unknown>,
) {
  return withUserStoreTransaction((store) => {
    const index = findImportantDateIndex(store, dateId);

    if (index === -1) {
      throw new Error("important date not found");
    }

    const existing = store.importantDates[index];
    const nextName = cleanRequiredString(body.name ?? existing.name);
    const nextDate = String(body.date ?? existing.date);

    if (!nextName || !nextDate) {
      throw new Error("name and date are required");
    }

    const duplicate = store.importantDates.find(
      (item, candidateIndex) =>
        candidateIndex !== index &&
        item.name.toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      throw new Error("important date already exists");
    }

    store.importantDates[index] = {
      ...existing,
      name: nextName,
      date: nextDate,
      notes: cleanOptionalString(body.notes ?? existing.notes),
      updatedAt: new Date().toISOString(),
    };

    return buildDefaultsOverview(store).importantDates.find(
      (current) => current.id === dateId,
    ) as ImportantDate;
  });
}

export async function deleteImportantDateRecord(dateId: string) {
  return withUserStoreTransaction((store) => {
    const index = findImportantDateIndex(store, dateId);

    if (index === -1) {
      throw new Error("important date not found");
    }

    const [deletedDate] = store.importantDates.splice(index, 1);

    return {
      deleted: true,
      importantDate: deletedDate,
    };
  });
}
