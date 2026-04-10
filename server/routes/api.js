import express from "express";
import { buildAuthPayload } from "../services/normalizers.js";
import {
  applyRecurringRules,
  buildDashboard,
  buildDefaultCategoryResponse,
  buildDefaultsOverview,
  buildEntryFromBody,
  buildProfileFromBody,
  buildReferenceData,
  filterEntries,
  getAccountUsageCount,
  getCurrentMonth,
  getExpenseKindUsageCount,
  getSubcategoryUsageCount,
  sortEntries,
  validateMonth,
} from "../services/storeModel.js";
import { DEFAULT_EXPENSE_KINDS } from "../config/defaultSeeds.js";
import { asyncHandler, HttpError } from "../http/errors.js";
import {
  cleanOptionalString,
  cleanRequiredString,
  uniqueSortedStrings,
  normalizeType,
} from "../utils/common.js";
import {
  getAuthProfileSync,
  readUserStore,
  requireAuth,
  updateUserStore,
} from "../services/userContext.js";

const router = express.Router();

function buildError(message, status = 400) {
  return new HttpError(status, message);
}

function findAccountIndex(userStore, accountId) {
  return userStore.defaults.accounts.findIndex(
    (account) => account.id === accountId,
  );
}

function findCategoryIndex(userStore, type, categoryId) {
  return userStore.defaults.categories[type].findIndex(
    (category) => category.id === categoryId,
  );
}

function findSubcategoryIndex(category, subcategoryId) {
  return category.subcategories.findIndex(
    (subcategory) => subcategory.id === subcategoryId,
  );
}

function findExpenseKindIndex(userStore, kindId) {
  return userStore.defaults.expenseKinds.findIndex(
    (kind) => kind.id === kindId,
  );
}

const SEEDED_EXPENSE_KIND_NAMES = new Set(
  DEFAULT_EXPENSE_KINDS.map((name) => name.toLowerCase()),
);

function removeHiddenSeedExpenseKind(defaults, kindName) {
  defaults.hiddenSeedExpenseKinds = defaults.hiddenSeedExpenseKinds.filter(
    (hiddenName) => hiddenName !== kindName.toLowerCase(),
  );
}

function findImportantDateIndex(userStore, dateId) {
  return userStore.importantDates.findIndex((item) => item.id === dateId);
}

function findRecurringRuleIndex(userStore, ruleId) {
  return userStore.recurringRules.findIndex((rule) => rule.id === ruleId);
}

function findEvenUpRecordIndex(userStore, recordId) {
  return userStore.evenUpRecords.findIndex((record) => record.id === recordId);
}

function findBillIndex(bills, billId) {
  return bills.findIndex((bill) => bill.id === billId);
}

function getNextEvenUpCode(store) {
  const maxNumber = store.evenUpRecords.reduce((currentMax, record) => {
    const match = record.code.match(/(\d+)$/);
    const numeric = Number(match?.[1]);
    return Number.isFinite(numeric)
      ? Math.max(currentMax, numeric)
      : currentMax;
  }, 0);

  return `EVN${String(maxNumber + 1).padStart(9, "0")}`;
}

function normalizeBillBody(body, existingBill) {
  const name = cleanRequiredString(body.name ?? existingBill?.name);

  if (!name) {
    throw buildError("name is required");
  }

  return {
    name,
    customerNumber: cleanOptionalString(
      body.customerNumber ?? existingBill?.customerNumber,
    ),
    consumerNumber: cleanOptionalString(
      body.consumerNumber ?? existingBill?.consumerNumber,
    ),
    meterNumber: cleanOptionalString(
      body.meterNumber ?? existingBill?.meterNumber,
    ),
    contractAccount: cleanOptionalString(
      body.contractAccount ?? existingBill?.contractAccount,
    ),
    identityNumber: cleanOptionalString(
      body.identityNumber ?? existingBill?.identityNumber,
    ),
    notes: cleanOptionalString(body.notes ?? existingBill?.notes),
  };
}

router.use(requireAuth);

router.get(
  "/auth/me",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildAuthPayload(userStore));
  }),
);

router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildAuthPayload(userStore));
  }),
);

router.put(
  "/profile",
  asyncHandler(async (req, res) => {
    const user = await updateUserStore(req, (store) => {
      const profileResult = buildProfileFromBody(req.body, store.profile);

      if (profileResult.error) {
        throw buildError(profileResult.error);
      }

      store.profile = profileResult.profile;
      return buildAuthPayload(store);
    });

    await getAuthProfileSync(req)(req.authUser.uid, user.profile).catch(
      () => undefined,
    );
    res.json(user);
  }),
);

router.get(
  "/reference-data",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildReferenceData(userStore));
  }),
);

router.get(
  "/defaults",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildDefaultsOverview(userStore));
  }),
);

router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const effectiveMonth = req.query.month ?? getCurrentMonth();

    if (!validateMonth(effectiveMonth)) {
      throw buildError("month must use YYYY-MM format");
    }

    const userStore = await readUserStore(req);
    res.json(buildDashboard(userStore, effectiveMonth));
  }),
);

async function sendEntriesList(req, res, forcedType) {
  const month = req.query.month;

  if (month && !validateMonth(month)) {
    throw buildError("month must use YYYY-MM format");
  }

  const userStore = await readUserStore(req);
  res.json(filterEntries(userStore, { type: forcedType, month }));
}

async function createEntry(req, res, forcedType) {
  const entry = await updateUserStore(req, (store) => {
    const result = buildEntryFromBody(
      forcedType ? { ...req.body, type: forcedType } : req.body,
      {
        forcedType,
        existingEntries: store.entries,
      },
    );

    if ("error" in result) {
      throw buildError(result.error);
    }

    store.entries.push(result.entry);
    store.entries = sortEntries(store.entries);
    return result.entry;
  });

  res.status(201).json(entry);
}

async function updateEntry(req, res, forcedType) {
  const entry = await updateUserStore(req, (store) => {
    const entryIndex = store.entries.findIndex((candidate) => {
      const matchesId = candidate.id === req.params.id;
      const matchesType = !forcedType || candidate.type === forcedType;
      return matchesId && matchesType;
    });

    if (entryIndex === -1) {
      throw buildError("entry not found", 404);
    }

    const result = buildEntryFromBody(
      forcedType ? { ...req.body, type: forcedType } : req.body,
      {
        forcedType,
        existingEntry: store.entries[entryIndex],
        existingEntries: store.entries,
      },
    );

    if ("error" in result) {
      throw buildError(result.error);
    }

    store.entries[entryIndex] = result.entry;
    store.entries = sortEntries(store.entries);
    return result.entry;
  });

  res.json(entry);
}

async function deleteEntry(req, res, forcedType) {
  const result = await updateUserStore(req, (store) => {
    const entryIndex = store.entries.findIndex((candidate) => {
      const matchesId = candidate.id === req.params.id;
      const matchesType = !forcedType || candidate.type === forcedType;
      return matchesId && matchesType;
    });

    if (entryIndex === -1) {
      throw buildError("entry not found", 404);
    }

    const [deletedEntry] = store.entries.splice(entryIndex, 1);
    return { deleted: true, entry: deletedEntry };
  });

  res.json(result);
}

router.get(
  "/entries",
  asyncHandler((req, res) => sendEntriesList(req, res)),
);
router.post(
  "/entries",
  asyncHandler((req, res) => createEntry(req, res)),
);
router.put(
  "/entries/:id",
  asyncHandler((req, res) => updateEntry(req, res)),
);
router.delete(
  "/entries/:id",
  asyncHandler((req, res) => deleteEntry(req, res)),
);
router.get(
  "/expenses",
  asyncHandler((req, res) => sendEntriesList(req, res, "expense")),
);
router.post(
  "/expenses",
  asyncHandler((req, res) => createEntry(req, res, "expense")),
);
router.put(
  "/expenses/:id",
  asyncHandler((req, res) => updateEntry(req, res, "expense")),
);
router.delete(
  "/expenses/:id",
  asyncHandler((req, res) => deleteEntry(req, res, "expense")),
);
router.get(
  "/incomes",
  asyncHandler((req, res) => sendEntriesList(req, res, "income")),
);
router.post(
  "/incomes",
  asyncHandler((req, res) => createEntry(req, res, "income")),
);
router.put(
  "/incomes/:id",
  asyncHandler((req, res) => updateEntry(req, res, "income")),
);
router.delete(
  "/incomes/:id",
  asyncHandler((req, res) => deleteEntry(req, res, "income")),
);

router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildDefaultsOverview(userStore).accounts);
  }),
);

router.post(
  "/accounts",
  asyncHandler(async (req, res) => {
    const account = await updateUserStore(req, (store) => {
      const name = cleanRequiredString(req.body.name);

      if (!name) {
        throw buildError("name is required");
      }

      const duplicate = store.defaults.accounts.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("account already exists", 409);
      }

      const now = new Date().toISOString();
      const accountValue = {
        id: crypto.randomUUID(),
        name,
        createdAt: now,
        updatedAt: now,
      };

      store.defaults.accounts.push(accountValue);
      store.defaults.accounts.sort((left, right) =>
        left.name.localeCompare(right.name),
      );

      return {
        ...accountValue,
        usageCount: getAccountUsageCount(store, accountValue.name),
      };
    });

    res.status(201).json(account);
  }),
);

router.put(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    const account = await updateUserStore(req, (store) => {
      const accountIndex = findAccountIndex(store, req.params.id);

      if (accountIndex === -1) {
        throw buildError("account not found", 404);
      }

      const nextName = cleanRequiredString(req.body.name);

      if (!nextName) {
        throw buildError("name is required");
      }

      const duplicate = store.defaults.accounts.find(
        (candidate, index) =>
          index !== accountIndex &&
          candidate.name.toLowerCase() === nextName.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("account already exists", 409);
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
        (candidate) => candidate.id === req.params.id,
      );

      return {
        ...updated,
        usageCount: getAccountUsageCount(store, nextName),
      };
    });

    res.json(account);
  }),
);

router.delete(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const accountIndex = findAccountIndex(store, req.params.id);

      if (accountIndex === -1) {
        throw buildError("account not found", 404);
      }

      const [deletedAccount] = store.defaults.accounts.splice(accountIndex, 1);
      const clearEntries = req.query.clearEntries === "true";

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

    res.json(result);
  }),
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    const overview = buildDefaultsOverview(userStore).categories;

    if (req.query.type === "income") {
      res.json(overview.income);
      return;
    }

    if (req.query.type === "expense") {
      res.json(overview.expense);
      return;
    }

    res.json(overview);
  }),
);

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const category = await updateUserStore(req, (store) => {
      const type = normalizeType(req.body.type, "expense");
      const name = cleanRequiredString(req.body.name);

      if (!name) {
        throw buildError("name is required");
      }

      const duplicate = store.defaults.categories[type].find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError(`${type} category already exists`, 409);
      }

      const subcategoryNames = Array.isArray(req.body.subcategories)
        ? uniqueSortedStrings(
            req.body.subcategories.map((value) => cleanRequiredString(value)),
          )
        : [];
      const now = new Date().toISOString();
      const categoryValue = {
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

      store.defaults.categories[type].push(categoryValue);
      store.defaults.categories[type].sort((left, right) =>
        left.name.localeCompare(right.name),
      );

      return buildDefaultCategoryResponse(store, categoryValue);
    });

    res.status(201).json(category);
  }),
);

router.put(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const category = await updateUserStore(req, (store) => {
      const currentType = req.query.type === "income" ? "income" : "expense";
      const categoryIndex = findCategoryIndex(
        store,
        currentType,
        req.params.id,
      );

      if (categoryIndex === -1) {
        throw buildError("category not found", 404);
      }

      const existingCategory =
        store.defaults.categories[currentType][categoryIndex];
      const nextType = req.body.type
        ? normalizeType(req.body.type, existingCategory.type)
        : existingCategory.type;
      const nextName = cleanRequiredString(
        req.body.name ?? existingCategory.name,
      );

      if (!nextName) {
        throw buildError("name is required");
      }

      const duplicate = store.defaults.categories[nextType].find(
        (candidate) =>
          candidate.id !== existingCategory.id &&
          candidate.name.toLowerCase() === nextName.toLowerCase(),
      );

      if (duplicate) {
        throw buildError(`${nextType} category already exists`, 409);
      }

      const now = new Date().toISOString();
      const previousType = existingCategory.type;
      const previousName = existingCategory.name;
      const nextCategory = {
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

    res.json(category);
  }),
);

router.delete(
  "/categories/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const type = req.query.type === "income" ? "income" : "expense";
      const categoryIndex = findCategoryIndex(store, type, req.params.id);

      if (categoryIndex === -1) {
        throw buildError("category not found", 404);
      }

      const [deletedCategory] = store.defaults.categories[type].splice(
        categoryIndex,
        1,
      );
      const clearEntries = req.query.clearEntries === "true";

      if (clearEntries) {
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
        clearedEntries: clearEntries,
        category: deletedCategory,
      };
    });

    res.json(result);
  }),
);

router.post(
  "/categories/:id/subcategories",
  asyncHandler(async (req, res) => {
    const subcategory = await updateUserStore(req, (store) => {
      const type = req.query.type === "income" ? "income" : "expense";
      const categoryIndex = findCategoryIndex(store, type, req.params.id);

      if (categoryIndex === -1) {
        throw buildError("category not found", 404);
      }

      const category = store.defaults.categories[type][categoryIndex];
      const name = cleanRequiredString(req.body.name);

      if (!name) {
        throw buildError("name is required");
      }

      const duplicate = category.subcategories.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("subcategory already exists", 409);
      }

      const now = new Date().toISOString();
      const nextSubcategory = {
        id: crypto.randomUUID(),
        name,
        createdAt: now,
        updatedAt: now,
      };

      category.subcategories.push(nextSubcategory);
      category.subcategories.sort((left, right) =>
        left.name.localeCompare(right.name),
      );
      category.updatedAt = now;

      return {
        ...nextSubcategory,
        usageCount: getSubcategoryUsageCount(store, type, category.name, name),
      };
    });

    res.status(201).json(subcategory);
  }),
);

router.put(
  "/categories/:id/subcategories/:subcategoryId",
  asyncHandler(async (req, res) => {
    const subcategory = await updateUserStore(req, (store) => {
      const type = req.query.type === "income" ? "income" : "expense";
      const categoryIndex = findCategoryIndex(store, type, req.params.id);

      if (categoryIndex === -1) {
        throw buildError("category not found", 404);
      }

      const category = store.defaults.categories[type][categoryIndex];
      const subcategoryIndex = findSubcategoryIndex(
        category,
        req.params.subcategoryId,
      );

      if (subcategoryIndex === -1) {
        throw buildError("subcategory not found", 404);
      }

      const nextName = cleanRequiredString(req.body.name);

      if (!nextName) {
        throw buildError("name is required");
      }

      const duplicate = category.subcategories.find(
        (candidate, index) =>
          index !== subcategoryIndex &&
          candidate.name.toLowerCase() === nextName.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("subcategory already exists", 409);
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
        (candidate) => candidate.id === req.params.subcategoryId,
      );

      return {
        ...updated,
        usageCount: getSubcategoryUsageCount(
          store,
          type,
          category.name,
          nextName,
        ),
      };
    });

    res.json(subcategory);
  }),
);

router.delete(
  "/categories/:id/subcategories/:subcategoryId",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const type = req.query.type === "income" ? "income" : "expense";
      const categoryIndex = findCategoryIndex(store, type, req.params.id);

      if (categoryIndex === -1) {
        throw buildError("category not found", 404);
      }

      const category = store.defaults.categories[type][categoryIndex];
      const subcategoryIndex = findSubcategoryIndex(
        category,
        req.params.subcategoryId,
      );

      if (subcategoryIndex === -1) {
        throw buildError("subcategory not found", 404);
      }

      const [deletedSubcategory] = category.subcategories.splice(
        subcategoryIndex,
        1,
      );
      const clearEntries = req.query.clearEntries === "true";
      const now = new Date().toISOString();
      category.updatedAt = now;

      if (clearEntries) {
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
        clearedEntries: clearEntries,
        subcategory: deletedSubcategory,
      };
    });

    res.json(result);
  }),
);

router.get(
  "/recurring-rules",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildDashboard(userStore, getCurrentMonth()).recurringRules);
  }),
);

router.post(
  "/recurring-rules",
  asyncHandler(async (req, res) => {
    const recurringRule = await updateUserStore(req, (store) => {
      const now = new Date().toISOString();
      const name = cleanOptionalString(req.body.name);
      const amount = Number(req.body.amount);
      const dayOfMonth = Number(req.body.dayOfMonth);

      if (
        !name ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(dayOfMonth)
      ) {
        throw buildError("name, amount, and day of month are required");
      }

      const rule = {
        id: crypto.randomUUID(),
        type: req.body.type === "income" ? "income" : "expense",
        status: cleanOptionalString(req.body.status) ?? "add",
        name,
        amount: Number(amount.toFixed(2)),
        frequency: cleanOptionalString(req.body.frequency) ?? "Monthly",
        dayOfMonth: Math.max(1, Math.min(31, Math.round(dayOfMonth))),
        account: cleanOptionalString(req.body.account),
        category: cleanOptionalString(req.body.category),
        entryKind:
          req.body.type === "income"
            ? null
            : (cleanOptionalString(req.body.entryKind) ?? "Regular"),
        counterparty: cleanOptionalString(req.body.counterparty),
        notes: cleanOptionalString(req.body.notes),
        startDate: String(req.body.startDate ?? now.slice(0, 10)),
        createdAt: now,
        updatedAt: now,
      };

      store.recurringRules.push(rule);

      return buildDashboard(store, getCurrentMonth()).recurringRules.find(
        (candidate) => candidate.id === rule.id,
      );
    });

    res.status(201).json(recurringRule);
  }),
);

router.put(
  "/recurring-rules/:id",
  asyncHandler(async (req, res) => {
    const recurringRule = await updateUserStore(req, (store) => {
      const index = findRecurringRuleIndex(store, req.params.id);

      if (index === -1) {
        throw buildError("recurring rule not found", 404);
      }

      const existing = store.recurringRules[index];
      const nextName = cleanOptionalString(req.body.name ?? existing.name);
      const nextAmount = Number(req.body.amount ?? existing.amount);
      const nextDayOfMonth = Number(req.body.dayOfMonth ?? existing.dayOfMonth);

      if (
        !nextName ||
        !Number.isFinite(nextAmount) ||
        nextAmount <= 0 ||
        !Number.isFinite(nextDayOfMonth)
      ) {
        throw buildError("name, amount, and day of month are required");
      }

      const nextType = req.body.type === "income" ? "income" : existing.type;

      store.recurringRules[index] = {
        ...existing,
        type: nextType,
        status: cleanOptionalString(req.body.status) ?? existing.status,
        name: nextName,
        amount: Number(nextAmount.toFixed(2)),
        frequency:
          cleanOptionalString(req.body.frequency) ?? existing.frequency,
        dayOfMonth: Math.max(1, Math.min(31, Math.round(nextDayOfMonth))),
        account: cleanOptionalString(req.body.account ?? existing.account),
        category: cleanOptionalString(req.body.category ?? existing.category),
        entryKind:
          nextType === "income"
            ? null
            : cleanOptionalString(req.body.entryKind ?? existing.entryKind),
        counterparty: cleanOptionalString(
          req.body.counterparty ?? existing.counterparty,
        ),
        notes: cleanOptionalString(req.body.notes ?? existing.notes),
        startDate: String(req.body.startDate ?? existing.startDate),
        updatedAt: new Date().toISOString(),
      };

      return buildDashboard(store, getCurrentMonth()).recurringRules.find(
        (candidate) => candidate.id === req.params.id,
      );
    });

    res.json(recurringRule);
  }),
);

router.delete(
  "/recurring-rules/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const index = findRecurringRuleIndex(store, req.params.id);

      if (index === -1) {
        throw buildError("recurring rule not found", 404);
      }

      const [deletedRule] = store.recurringRules.splice(index, 1);

      return {
        deleted: true,
        recurringRule: deletedRule,
      };
    });

    res.json(result);
  }),
);

router.post(
  "/recurring-rules/run",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(
      req,
      (store) => {
        const recurringResult = applyRecurringRules(store);

        return {
          createdCount: recurringResult.createdEntries.length,
          createdEntries: recurringResult.createdEntries,
          triggeredRuleIds: recurringResult.triggeredRuleIds.filter(Boolean),
        };
      },
      { skipRecurring: true },
    );

    res.json(result);
  }),
);

router.get(
  "/even-up",
  asyncHandler(async (req, res) => {
    const userStore = await readUserStore(req);
    res.json(buildDashboard(userStore, getCurrentMonth()).evenUpRecords);
  }),
);

router.post(
  "/even-up",
  asyncHandler(async (req, res) => {
    const evenUpRecord = await updateUserStore(req, (store) => {
      const startDate = String(req.body.startDate ?? "");
      const endDate = String(req.body.endDate ?? "");

      if (!startDate || !endDate) {
        throw buildError("start date and end date are required");
      }

      const now = new Date().toISOString();
      const record = {
        id: crypto.randomUUID(),
        code: getNextEvenUpCode(store),
        status: cleanOptionalString(req.body.status) ?? "Open",
        startDate,
        endDate,
        from: cleanOptionalString(req.body.from),
        to: cleanOptionalString(req.body.to),
        paid: Math.max(0, Number(req.body.paid ?? 0) || 0),
        notes: cleanOptionalString(req.body.notes),
        createdAt: now,
        updatedAt: now,
      };

      store.evenUpRecords.push(record);

      return buildDashboard(store, getCurrentMonth()).evenUpRecords.find(
        (candidate) => candidate.id === record.id,
      );
    });

    res.status(201).json(evenUpRecord);
  }),
);

router.put(
  "/even-up/:id",
  asyncHandler(async (req, res) => {
    const evenUpRecord = await updateUserStore(req, (store) => {
      const index = findEvenUpRecordIndex(store, req.params.id);

      if (index === -1) {
        throw buildError("even-up record not found", 404);
      }

      const existing = store.evenUpRecords[index];
      const startDate = String(req.body.startDate ?? existing.startDate);
      const endDate = String(req.body.endDate ?? existing.endDate);

      if (!startDate || !endDate) {
        throw buildError("start date and end date are required");
      }

      store.evenUpRecords[index] = {
        ...existing,
        status: cleanOptionalString(req.body.status) ?? existing.status,
        startDate,
        endDate,
        from: cleanOptionalString(req.body.from ?? existing.from),
        to: cleanOptionalString(req.body.to ?? existing.to),
        paid: Math.max(0, Number(req.body.paid ?? existing.paid) || 0),
        notes: cleanOptionalString(req.body.notes ?? existing.notes),
        updatedAt: new Date().toISOString(),
      };

      return buildDashboard(store, getCurrentMonth()).evenUpRecords.find(
        (candidate) => candidate.id === req.params.id,
      );
    });

    res.json(evenUpRecord);
  }),
);

router.delete(
  "/even-up/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const index = findEvenUpRecordIndex(store, req.params.id);

      if (index === -1) {
        throw buildError("even-up record not found", 404);
      }

      const [deletedRecord] = store.evenUpRecords.splice(index, 1);

      return {
        deleted: true,
        evenUpRecord: deletedRecord,
      };
    });

    res.json(result);
  }),
);

router.post(
  "/expense-kinds",
  asyncHandler(async (req, res) => {
    const expenseKind = await updateUserStore(req, (store) => {
      const name = cleanRequiredString(req.body.name);

      if (!name) {
        throw buildError("name is required");
      }

      const duplicate = store.defaults.expenseKinds.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("expense kind already exists", 409);
      }

      const now = new Date().toISOString();
      const kind = {
        id: crypto.randomUUID(),
        name,
        createdAt: now,
        updatedAt: now,
      };

      store.defaults.expenseKinds.push(kind);
      store.defaults.expenseKinds.sort((left, right) =>
        left.name.localeCompare(right.name),
      );
      removeHiddenSeedExpenseKind(store.defaults, kind.name);

      return {
        ...kind,
        usageCount: getExpenseKindUsageCount(store, kind.name),
      };
    });

    res.status(201).json(expenseKind);
  }),
);

router.put(
  "/expense-kinds/:id",
  asyncHandler(async (req, res) => {
    const expenseKind = await updateUserStore(req, (store) => {
      const kindIndex = findExpenseKindIndex(store, req.params.id);

      if (kindIndex === -1) {
        throw buildError("expense kind not found", 404);
      }

      const nextName = cleanRequiredString(req.body.name);

      if (!nextName) {
        throw buildError("name is required");
      }

      const duplicate = store.defaults.expenseKinds.find(
        (candidate, index) =>
          index !== kindIndex &&
          candidate.name.toLowerCase() === nextName.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("expense kind already exists", 409);
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
      removeHiddenSeedExpenseKind(store.defaults, previousName);
      removeHiddenSeedExpenseKind(store.defaults, nextName);
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
        (candidate) => candidate.id === req.params.id,
      );

      return {
        ...updated,
        usageCount: getExpenseKindUsageCount(store, updated.name),
      };
    });

    res.json(expenseKind);
  }),
);

router.delete(
  "/expense-kinds/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const kindIndex = findExpenseKindIndex(store, req.params.id);

      if (kindIndex === -1) {
        throw buildError("expense kind not found", 404);
      }

      const [deletedKind] = store.defaults.expenseKinds.splice(kindIndex, 1);
      const clearEntries = req.query.clearEntries === "true";

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

    res.json(result);
  }),
);

router.post(
  "/important-dates",
  asyncHandler(async (req, res) => {
    const importantDate = await updateUserStore(req, (store) => {
      const name = cleanRequiredString(req.body.name);
      const date = req.body.date ? String(req.body.date) : "";

      if (!name || !date) {
        throw buildError("name and date are required");
      }

      const duplicate = store.importantDates.find(
        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("important date already exists", 409);
      }

      const now = new Date().toISOString();
      const item = {
        id: crypto.randomUUID(),
        name,
        date,
        notes: cleanOptionalString(req.body.notes),
        createdAt: now,
        updatedAt: now,
      };

      store.importantDates.push(item);

      return buildDefaultsOverview(store).importantDates.find(
        (candidate) => candidate.id === item.id,
      );
    });

    res.status(201).json(importantDate);
  }),
);

router.put(
  "/important-dates/:id",
  asyncHandler(async (req, res) => {
    const importantDate = await updateUserStore(req, (store) => {
      const index = findImportantDateIndex(store, req.params.id);

      if (index === -1) {
        throw buildError("important date not found", 404);
      }

      const existing = store.importantDates[index];
      const nextName = cleanRequiredString(req.body.name ?? existing.name);
      const nextDate = String(req.body.date ?? existing.date);

      if (!nextName || !nextDate) {
        throw buildError("name and date are required");
      }

      const duplicate = store.importantDates.find(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          candidate.name.toLowerCase() === nextName.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("important date already exists", 409);
      }

      store.importantDates[index] = {
        ...existing,
        name: nextName,
        date: nextDate,
        notes: cleanOptionalString(req.body.notes ?? existing.notes),
        updatedAt: new Date().toISOString(),
      };

      return buildDefaultsOverview(store).importantDates.find(
        (candidate) => candidate.id === req.params.id,
      );
    });

    res.json(importantDate);
  }),
);

router.delete(
  "/important-dates/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const index = findImportantDateIndex(store, req.params.id);

      if (index === -1) {
        throw buildError("important date not found", 404);
      }

      const [deletedDate] = store.importantDates.splice(index, 1);

      return {
        deleted: true,
        importantDate: deletedDate,
      };
    });

    res.json(result);
  }),
);

router.post(
  "/bills",
  asyncHandler(async (req, res) => {
    const bill = await updateUserStore(req, (store) => {
      const nextBill = normalizeBillBody(req.body);
      const duplicate = store.bills.find(
        (candidate) =>
          candidate.name.toLowerCase() === nextBill.name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("bill already exists", 409);
      }

      const now = new Date().toISOString();
      const billValue = {
        id: crypto.randomUUID(),
        ...nextBill,
        createdAt: now,
        updatedAt: now,
      };

      store.bills.push(billValue);
      store.bills.sort((left, right) => left.name.localeCompare(right.name));
      return billValue;
    });

    res.status(201).json(bill);
  }),
);

router.put(
  "/bills/:id",
  asyncHandler(async (req, res) => {
    const bill = await updateUserStore(req, (store) => {
      const billIndex = findBillIndex(store.bills, req.params.id);

      if (billIndex === -1) {
        throw buildError("bill not found", 404);
      }

      const existingBill = store.bills[billIndex];
      const nextBill = normalizeBillBody(req.body, existingBill);
      const duplicate = store.bills.find(
        (candidate, index) =>
          index !== billIndex &&
          candidate.name.toLowerCase() === nextBill.name.toLowerCase(),
      );

      if (duplicate) {
        throw buildError("bill already exists", 409);
      }

      store.bills[billIndex] = {
        ...existingBill,
        ...nextBill,
        updatedAt: new Date().toISOString(),
      };
      store.bills.sort((left, right) => left.name.localeCompare(right.name));

      return store.bills.find((candidate) => candidate.id === req.params.id);
    });

    res.json(bill);
  }),
);

router.delete(
  "/bills/:id",
  asyncHandler(async (req, res) => {
    const result = await updateUserStore(req, (store) => {
      const billIndex = findBillIndex(store.bills, req.params.id);

      if (billIndex === -1) {
        throw buildError("bill not found", 404);
      }

      const [deletedBill] = store.bills.splice(billIndex, 1);
      return {
        deleted: true,
        bill: deletedBill,
      };
    });

    res.json(result);
  }),
);

router.put(
  "/notepad",
  asyncHandler(async (req, res) => {
    const notepad = await updateUserStore(req, (store) => {
      if (typeof req.body.content !== "string") {
        throw buildError("content is required");
      }

      store.notepad = {
        content: req.body.content,
        updatedAt: new Date().toISOString(),
      };

      return store.notepad;
    });

    res.json(notepad);
  }),
);

export default router;
