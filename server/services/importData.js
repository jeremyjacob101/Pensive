import { normalizeStoredUserStore } from "./normalizers.js";

function getImportPayload(rawPayload) {
  const payload =
    rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const defaults =
    payload.defaults && typeof payload.defaults === "object"
      ? payload.defaults
      : {};

  return {
    profile: payload.profile,
    entries: Array.isArray(payload.entries) ? payload.entries : [],
    defaults: {
      accounts: Array.isArray(defaults.accounts) ? defaults.accounts : [],
      categories:
        defaults.categories && typeof defaults.categories === "object"
          ? defaults.categories
          : { expense: [], income: [] },
      expenseKinds: Array.isArray(defaults.expenseKinds)
        ? defaults.expenseKinds
        : [],
      hiddenSeedExpenseKinds: Array.isArray(defaults.hiddenSeedExpenseKinds)
        ? defaults.hiddenSeedExpenseKinds
        : [],
    },
    recurringRules: Array.isArray(payload.recurringRules)
      ? payload.recurringRules
      : [],
    importantDates: Array.isArray(payload.importantDates)
      ? payload.importantDates
      : Array.isArray(defaults.importantDates)
        ? defaults.importantDates
        : [],
    bills: Array.isArray(payload.bills)
      ? payload.bills
      : Array.isArray(defaults.bills)
        ? defaults.bills
        : [],
    notepad: payload.notepad ?? defaults.notepad,
    evenUpRecords: Array.isArray(payload.evenUpRecords)
      ? payload.evenUpRecords
      : [],
  };
}

function keyByIdOrName(item) {
  return String(item.id ?? item.name ?? "")
    .trim()
    .toLowerCase();
}

function keyByName(item) {
  return String(item.name ?? "")
    .trim()
    .toLowerCase();
}

function keyByEntry(entry) {
  return String(
    entry.recurringOccurrenceKey ?? entry.entryCode ?? entry.id ?? "",
  )
    .trim()
    .toLowerCase();
}

function keyByEvenUpRecord(record) {
  return String(record.code ?? record.id ?? "")
    .trim()
    .toLowerCase();
}

function mergeByKey(currentItems, importedItems, getKey) {
  const seen = new Set(currentItems.map(getKey).filter(Boolean));
  const added = [];

  importedItems.forEach((item) => {
    const key = getKey(item);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    added.push(item);
  });

  return {
    items: [...currentItems, ...added],
    addedCount: added.length,
  };
}

function mergeCategories(currentCategories, importedCategories) {
  const summary = {
    expense: { added: 0, skipped: 0 },
    income: { added: 0, skipped: 0 },
  };
  const categories = {
    expense: [...currentCategories.expense],
    income: [...currentCategories.income],
  };

  for (const type of ["expense", "income"]) {
    const existingByName = new Map(
      categories[type].map((category) => [
        category.name.toLowerCase(),
        category,
      ]),
    );

    importedCategories[type].forEach((category) => {
      const key = category.name.toLowerCase();
      const existingCategory = existingByName.get(key);

      if (!existingCategory) {
        categories[type].push(category);
        existingByName.set(key, category);
        summary[type].added += 1;
        return;
      }

      const subcategoryMerge = mergeByKey(
        existingCategory.subcategories,
        category.subcategories,
        keyByName,
      );
      existingCategory.subcategories = subcategoryMerge.items;
      summary[type].skipped += 1;
    });
  }

  return { categories, summary };
}

export function importFinanceData(currentStore, rawPayload, authUser) {
  const importPayload = getImportPayload(rawPayload);
  const importedStore = normalizeStoredUserStore(
    currentStore.profile.username,
    importPayload,
    authUser.email,
  );

  const entries = mergeByKey(
    currentStore.entries,
    importedStore.entries,
    keyByEntry,
  );
  const accounts = mergeByKey(
    currentStore.defaults.accounts,
    importedStore.defaults.accounts,
    keyByName,
  );
  const expenseKinds = mergeByKey(
    currentStore.defaults.expenseKinds,
    importedStore.defaults.expenseKinds,
    keyByName,
  );
  const categoryMerge = mergeCategories(
    currentStore.defaults.categories,
    importedStore.defaults.categories,
  );
  const recurringRules = mergeByKey(
    currentStore.recurringRules,
    importedStore.recurringRules,
    keyByIdOrName,
  );
  const importantDates = mergeByKey(
    currentStore.importantDates,
    importedStore.importantDates,
    keyByIdOrName,
  );
  const bills = mergeByKey(currentStore.bills, importedStore.bills, keyByName);
  const evenUpRecords = mergeByKey(
    currentStore.evenUpRecords,
    importedStore.evenUpRecords,
    keyByEvenUpRecord,
  );

  currentStore.entries = entries.items;
  currentStore.defaults.accounts = accounts.items;
  currentStore.defaults.categories = categoryMerge.categories;
  currentStore.defaults.expenseKinds = expenseKinds.items;
  currentStore.recurringRules = recurringRules.items;
  currentStore.importantDates = importantDates.items;
  currentStore.bills = bills.items;
  currentStore.evenUpRecords = evenUpRecords.items;

  if (importedStore.notepad.content) {
    currentStore.notepad = importedStore.notepad;
  }

  return {
    imported: {
      entries: entries.addedCount,
      accounts: accounts.addedCount,
      categories:
        categoryMerge.summary.expense.added +
        categoryMerge.summary.income.added,
      expenseKinds: expenseKinds.addedCount,
      recurringRules: recurringRules.addedCount,
      importantDates: importantDates.addedCount,
      bills: bills.addedCount,
      evenUpRecords: evenUpRecords.addedCount,
      notepad: importedStore.notepad.content ? 1 : 0,
    },
  };
}
