import { SEED_TIMESTAMP } from "../config/constants.js";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_KINDS,
  DEFAULT_IMPORTANT_DATES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INCOME_SUBCATEGORIES,
  DEFAULT_RECURRING_TEMPLATES,
  DEFAULT_SUBCATEGORIES,
} from "../config/defaultSeeds.js";
import {
  buildCurrentMonthStartDate,
  cleanOptionalString,
  cleanRequiredString,
  createId,
  inferLegacyTimestamp,
  isPlainObject,
  normalizeAge,
  normalizeDateInput,
  normalizeEmail,
  normalizeTimestamp,
  normalizeType,
  parseAmount,
  parseNumberish,
  slugifyIdPart,
} from "../utils/common.js";
import { normalizeRecurringStatus } from "./recurringRules.js";
import { normalizeEntryCode } from "./storeModel.js";

function dedupeByName(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = item.name.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createSeedAccount(name) {
  const slug = slugifyIdPart(name);

  return {
    id: `account-${slug}`,
    name,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

function createSeedExpenseKind(name) {
  return {
    id: `expense-kind-${slugifyIdPart(name)}`,
    name,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

function createSeedCategory(type, name, subcategoryNames = []) {
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

function createSeedRecurringRule(template) {
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

function createSeedImportantDate(template) {
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
    expenseKinds: DEFAULT_EXPENSE_KINDS.map((name) => createSeedExpenseKind(name)),
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

function normalizeStoredEntry(entry, fallbackType = "expense", fallbackIndex = 0) {
  if (!isPlainObject(entry)) {
    return null;
  }

  const type = normalizeType(entry.type, fallbackType);
  const name = cleanOptionalString(entry.name);
  const amount = parseAmount(entry.amount);
  const inferredCreatedAt = inferLegacyTimestamp(entry);
  const createdAt = normalizeTimestamp(entry.createdAt, inferredCreatedAt ?? undefined);
  const updatedAt = normalizeTimestamp(entry.updatedAt, createdAt);
  const date = normalizeDateInput(entry.date, createdAt.slice(0, 10));

  if (!name || amount === null || !date) {
    return null;
  }

  const entryCode = normalizeEntryCode(
    cleanOptionalString(entry.entryCode ?? entry.expenseId ?? entry.incomingId),
    type,
    fallbackIndex + 1,
  );

  return {
    id: cleanOptionalString(entry.id) ?? createId(),
    type,
    name,
    amount,
    category: cleanOptionalString(entry.category),
    subcategory: cleanOptionalString(entry.subcategory ?? entry.subCategory),
    date,
    account: cleanOptionalString(entry.account),
    notes: cleanOptionalString(entry.notes),
    entryKind:
      cleanOptionalString(entry.entryKind ?? entry.kind ?? entry.expenseKind) ??
      (type === "expense" ? "Regular" : null),
    counterparty: cleanOptionalString(entry.counterparty ?? entry.paidTo ?? entry.paidBy),
    comments: cleanOptionalString(entry.comments),
    entryCode,
    allocationMonths: Array.isArray(entry.allocationMonths)
      ? entry.allocationMonths.filter(Boolean)
      : [],
    linkedRecurringRuleId: cleanOptionalString(entry.linkedRecurringRuleId),
    recurringOccurrenceKey: cleanOptionalString(entry.recurringOccurrenceKey),
    createdAt,
    updatedAt,
  };
}

function normalizeStoredAccount(account) {
  if (typeof account === "string") {
    return {
      id: `account-${slugifyIdPart(account) || createId()}`,
      name: account.trim(),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
  }

  if (!isPlainObject(account)) {
    return null;
  }

  const name = cleanRequiredString(account.name);

  if (!name) {
    return null;
  }

  const createdAt = normalizeTimestamp(account.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(account.id) ?? createId(),
    name,
    createdAt,
    updatedAt: normalizeTimestamp(account.updatedAt, createdAt),
  };
}

function normalizeStoredExpenseKind(kind) {
  if (typeof kind === "string") {
    return createSeedExpenseKind(kind);
  }

  if (!isPlainObject(kind)) {
    return null;
  }

  const name = cleanRequiredString(kind.name);

  if (!name) {
    return null;
  }

  const createdAt = normalizeTimestamp(kind.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(kind.id) ?? createId(),
    name,
    createdAt,
    updatedAt: normalizeTimestamp(kind.updatedAt, createdAt),
  };
}

function normalizeStoredSubcategory(subcategory, fallbackPrefix) {
  if (typeof subcategory === "string") {
    return {
      id: `${fallbackPrefix}-${slugifyIdPart(subcategory) || createId()}`,
      name: subcategory.trim(),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
  }

  if (!isPlainObject(subcategory)) {
    return null;
  }

  const name = cleanRequiredString(subcategory.name);

  if (!name) {
    return null;
  }

  const createdAt = normalizeTimestamp(subcategory.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(subcategory.id) ?? createId(),
    name,
    createdAt,
    updatedAt: normalizeTimestamp(subcategory.updatedAt, createdAt),
  };
}

export function normalizeStoredCategory(category, fallbackType) {
  if (typeof category === "string") {
    return createSeedCategory(fallbackType, category, []);
  }

  if (!isPlainObject(category)) {
    return null;
  }

  const type = normalizeType(category.type, fallbackType);
  const name = cleanRequiredString(category.name);

  if (!name) {
    return null;
  }

  const createdAt = normalizeTimestamp(category.createdAt, SEED_TIMESTAMP);
  const categorySlug = slugifyIdPart(name) || createId();

  return {
    id: cleanOptionalString(category.id) ?? createId(),
    type,
    name,
    subcategories: Array.isArray(category.subcategories)
      ? category.subcategories
          .map((subcategory) =>
            normalizeStoredSubcategory(subcategory, `${type}-subcategory-${categorySlug}`),
          )
          .filter(Boolean)
      : [],
    createdAt,
    updatedAt: normalizeTimestamp(category.updatedAt, createdAt),
  };
}

function normalizeStoredRecurringRule(rule) {
  if (!isPlainObject(rule)) {
    return null;
  }

  const name = cleanRequiredString(rule.name);
  const amount = parseAmount(rule.amount);
  const startDate = normalizeDateInput(rule.startDate, undefined);

  if (!name || amount === null || !startDate) {
    return null;
  }

  const createdAt = normalizeTimestamp(rule.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(rule.id) ?? createId(),
    type: normalizeType(rule.type, "expense"),
    status: normalizeRecurringStatus(rule.status),
    name,
    amount,
    frequency: cleanOptionalString(rule.frequency) ?? "Monthly",
    dayOfMonth: Math.max(1, Math.min(31, Number(rule.dayOfMonth) || 1)),
    account: cleanOptionalString(rule.account),
    category: cleanOptionalString(rule.category),
    entryKind:
      normalizeType(rule.type, "expense") === "income"
        ? null
        : cleanOptionalString(rule.entryKind) ?? "Regular",
    counterparty: cleanOptionalString(rule.counterparty),
    notes: cleanOptionalString(rule.notes),
    startDate,
    createdAt,
    updatedAt: normalizeTimestamp(rule.updatedAt, createdAt),
  };
}

function normalizeStoredMetadata(value) {
  void value;
  return {};
}

function normalizeStoredImportantDate(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const name = cleanRequiredString(value.name);
  const date = normalizeDateInput(value.date, undefined);

  if (!name || !date) {
    return null;
  }

  const createdAt = normalizeTimestamp(value.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(value.id) ?? createId(),
    name,
    date,
    notes: cleanOptionalString(value.notes),
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  };
}

function normalizeStoredBillReference(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const name = cleanRequiredString(value.name);

  if (!name) {
    return null;
  }

  const createdAt = normalizeTimestamp(value.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(value.id) ?? createId(),
    name,
    customerNumber: cleanOptionalString(value.customerNumber),
    consumerNumber: cleanOptionalString(value.consumerNumber),
    meterNumber: cleanOptionalString(value.meterNumber),
    contractAccount: cleanOptionalString(value.contractAccount),
    identityNumber: cleanOptionalString(value.identityNumber),
    notes: cleanOptionalString(value.notes),
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  };
}

function normalizeStoredNotepad(value) {
  const parsedValue = isPlainObject(value) ? value : {};

  return {
    content: String(parsedValue.content ?? ""),
    updatedAt: cleanOptionalString(parsedValue.updatedAt),
  };
}

function normalizeStoredEvenUpRecord(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  const startDate = normalizeDateInput(value.startDate ?? value.start, undefined);
  const endDate = normalizeDateInput(value.endDate ?? value.end, startDate ?? undefined);

  if (!startDate || !endDate) {
    return null;
  }

  const createdAt = normalizeTimestamp(value.createdAt, SEED_TIMESTAMP);

  return {
    id: cleanOptionalString(value.id) ?? createId(),
    code:
      cleanOptionalString(value.code) ??
      cleanOptionalString(value.evenUpId) ??
      `EVN${String(1).padStart(9, "0")}`,
    status: cleanOptionalString(value.status) ?? "Open",
    startDate,
    endDate,
    from: cleanOptionalString(value.from),
    to: cleanOptionalString(value.to),
    paid: Math.max(0, parseNumberish(value.paid)),
    notes: cleanOptionalString(value.notes),
    createdAt,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
  };
}

function normalizeStoredDefaults(defaults) {
  const seededDefaults = createSeedDefaults();
  const parsedDefaults = isPlainObject(defaults) ? defaults : {};

  const rawAccounts = Array.isArray(parsedDefaults.accounts)
    ? parsedDefaults.accounts
    : seededDefaults.accounts;
  const rawExpenseCategories =
    isPlainObject(parsedDefaults.categories) && Array.isArray(parsedDefaults.categories.expense)
      ? parsedDefaults.categories.expense
      : seededDefaults.categories.expense;
  const rawIncomeCategories =
    isPlainObject(parsedDefaults.categories) && Array.isArray(parsedDefaults.categories.income)
      ? parsedDefaults.categories.income
      : seededDefaults.categories.income;
  const hiddenSeedExpenseKinds = Array.isArray(parsedDefaults.hiddenSeedExpenseKinds)
    ? parsedDefaults.hiddenSeedExpenseKinds
        .map((kind) => cleanOptionalString(kind)?.toLowerCase() ?? null)
        .filter(Boolean)
    : [];
  const rawExpenseKinds = Array.isArray(parsedDefaults.expenseKinds)
    ? parsedDefaults.expenseKinds
    : seededDefaults.expenseKinds.filter(
        (kind) => !hiddenSeedExpenseKinds.includes(kind.name.toLowerCase()),
      );

  return {
    accounts: dedupeByName(rawAccounts.map(normalizeStoredAccount).filter(Boolean)).sort(
      (left, right) => left.name.localeCompare(right.name),
    ),
    categories: {
      expense: dedupeByName(
        rawExpenseCategories.map((category) => normalizeStoredCategory(category, "expense")).filter(Boolean),
      ).sort((left, right) => left.name.localeCompare(right.name)),
      income: dedupeByName(
        rawIncomeCategories.map((category) => normalizeStoredCategory(category, "income")).filter(Boolean),
      ).sort((left, right) => left.name.localeCompare(right.name)),
    },
    expenseKinds: dedupeByName(
      rawExpenseKinds.map(normalizeStoredExpenseKind).filter(Boolean),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    hiddenSeedExpenseKinds: [...new Set(hiddenSeedExpenseKinds)].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function normalizeStoredProfile(username, profile, fallbackEmail) {
  const parsedProfile = isPlainObject(profile) ? profile : {};
  const createdAt = normalizeTimestamp(parsedProfile.createdAt, SEED_TIMESTAMP);

  return {
    username,
    fullName: cleanOptionalString(parsedProfile.fullName) ?? username,
    email: normalizeEmail(parsedProfile.email) ?? normalizeEmail(fallbackEmail),
    age: normalizeAge(parsedProfile.age),
    pictureUrl: cleanOptionalString(parsedProfile.pictureUrl ?? parsedProfile.picture),
    createdAt,
    updatedAt: normalizeTimestamp(parsedProfile.updatedAt, createdAt),
  };
}

export function normalizeStoredUserStore(username, rawStore, fallbackEmail) {
  const parsedStore = isPlainObject(rawStore) ? rawStore : {};
  const entries = Array.isArray(parsedStore.entries)
    ? parsedStore.entries
        .map((entry, index) => normalizeStoredEntry(entry, "expense", index))
        .filter(Boolean)
    : [];

  return {
    profile: normalizeStoredProfile(username, parsedStore.profile, fallbackEmail),
    metadata: normalizeStoredMetadata(parsedStore.metadata),
    entries,
    defaults: normalizeStoredDefaults(parsedStore.defaults),
    recurringRules: Array.isArray(parsedStore.recurringRules)
      ? dedupeByName(parsedStore.recurringRules.map(normalizeStoredRecurringRule).filter(Boolean))
      : createSeedRecurringRules(),
    importantDates: Array.isArray(parsedStore.importantDates)
      ? dedupeByName(parsedStore.importantDates.map(normalizeStoredImportantDate).filter(Boolean))
      : createSeedImportantDates(),
    bills: Array.isArray(parsedStore.bills)
      ? dedupeByName(parsedStore.bills.map(normalizeStoredBillReference).filter(Boolean))
      : [],
    notepad: normalizeStoredNotepad(parsedStore.notepad),
    evenUpRecords: Array.isArray(parsedStore.evenUpRecords)
      ? parsedStore.evenUpRecords.map(normalizeStoredEvenUpRecord).filter(Boolean)
      : [],
  };
}

export function buildAuthPayload(userStore) {
  return {
    username: userStore.profile.username,
    profile: userStore.profile,
  };
}
