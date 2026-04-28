import { DEFAULT_COUNTERPARTY_SUGGESTIONS } from "../config/defaultSeeds.js";
import {
  cleanOptionalString,
  cleanRequiredString,
  createId,
  getCurrentMonth,
  getMonthLabelFromDate,
  getValueFromBody,
  normalizeAge,
  normalizeAllocationMonths,
  normalizeDateInput,
  normalizeEmail,
  normalizeType,
  parseAmount,
  uniqueSortedStrings,
} from "../utils/common.js";
import {
  buildOccurrenceDate,
  buildOccurrenceKey,
  formatLocalDateKey,
  isRecurringRuleActive,
  parseRecurringIntervalMonths,
} from "./recurringRules.js";

export { getCurrentMonth };

export const PARTIAL_REIMBURSEMENT_TYPES = new Set([
  "partial reimbursement",
  "split reimbursement",
]);
export const REIMBURSEMENT_TYPES = new Set(["reimbursement", "refund"]);
export const SHARED_PAYMENT_TYPES = new Set([
  "shared payment",
  "split payment",
]);
export const PARTIAL_SHARED_PAYMENT_TYPES = new Set([
  "partial shared payment",
  "split cost",
]);

const ENTRY_CODE_PATTERN = /^(EXP|INC)(\d+)(?:-(\d+))?$/i;
const SERIAL_PAD_LENGTH = 12;
const SUFFIX_PAD_LENGTH = 3;

function getPrefix(type) {
  return type === "income" ? "INC" : "EXP";
}

function padSerial(serial) {
  return String(serial).padStart(SERIAL_PAD_LENGTH, "0");
}

function padSuffix(suffix) {
  return String(suffix).padStart(SUFFIX_PAD_LENGTH, "0");
}

export function formatEntryCode(prefix, serial, suffix = 0) {
  return `${prefix}${padSerial(Math.max(1, serial))}-${padSuffix(Math.max(0, suffix))}`;
}

export function parseEntryCode(value) {
  const cleaned = String(value ?? "").trim();
  const match = cleaned.match(ENTRY_CODE_PATTERN);

  if (!match) {
    return null;
  }

  const prefix = match[1].toUpperCase();
  const serial = Number.parseInt(match[2], 10);
  const suffix = Number.parseInt(match[3] ?? "0", 10);

  if (
    !Number.isInteger(serial) ||
    serial <= 0 ||
    !Number.isInteger(suffix) ||
    suffix < 0
  ) {
    return null;
  }

  return {
    prefix,
    serial,
    suffix,
    canonical: formatEntryCode(prefix, serial, suffix),
  };
}

export function normalizeEntryCode(
  value,
  type,
  fallbackSerial,
  fallbackSuffix = 0,
) {
  const parsed = parseEntryCode(value);

  if (parsed && parsed.prefix === getPrefix(type)) {
    return parsed.canonical;
  }

  return formatEntryCode(getPrefix(type), fallbackSerial, fallbackSuffix);
}

export function getNextEntryCode(existingEntries, type) {
  const prefix = getPrefix(type);
  const maxSerial = existingEntries.reduce((currentMax, entry) => {
    const parsed = parseEntryCode(entry.entryCode);

    if (!parsed || parsed.prefix !== prefix) {
      return currentMax;
    }

    return Math.max(currentMax, parsed.serial);
  }, 0);

  return formatEntryCode(prefix, maxSerial + 1, 0);
}

export function getNextSplitEntryCode(existingEntries, type, anchorEntryCode) {
  const anchor = parseEntryCode(anchorEntryCode);
  const prefix = getPrefix(type);

  if (!anchor || anchor.prefix !== prefix) {
    return getNextEntryCode(existingEntries, type);
  }

  const maxSuffix = existingEntries.reduce((currentMax, entry) => {
    const parsed = parseEntryCode(entry.entryCode);

    if (
      !parsed ||
      parsed.prefix !== prefix ||
      parsed.serial !== anchor.serial
    ) {
      return currentMax;
    }

    return Math.max(currentMax, parsed.suffix);
  }, anchor.suffix);

  return formatEntryCode(prefix, anchor.serial, maxSuffix + 1);
}

export function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftValue = `${left.date}-${left.updatedAt}`;
    const rightValue = `${right.date}-${right.updatedAt}`;
    return rightValue.localeCompare(leftValue);
  });
}

export function filterEntries(userStore, filters = {}) {
  const { type, month } = filters;

  return sortEntries(
    userStore.entries.filter((entry) => {
      const matchesType = !type || entry.type === type;
      const matchesMonth = !month || entry.date.startsWith(`${month}-`);
      return matchesType && matchesMonth;
    }),
  );
}

function getMostRecentEntryCode(existingEntries, type) {
  return (
    sortEntries(existingEntries.filter((entry) => entry.type === type))[0]
      ?.entryCode ?? null
  );
}

export function buildEntryFromBody(body, options = {}) {
  const { forcedType, existingEntry, existingEntries = [], now } = options;
  const timestamp = now ?? new Date().toISOString();
  const fallbackDate = existingEntry?.date ?? timestamp.slice(0, 10);
  const fallbackCreatedAt = existingEntry?.createdAt ?? timestamp;
  const type =
    forcedType ?? normalizeType(body.type, existingEntry?.type ?? "expense");
  const rawNameValue = getValueFromBody(body, "name", existingEntry?.name);
  const startingName = cleanOptionalString(rawNameValue) || "";
  const sameGroup = !existingEntry && startingName.startsWith("SAME ");
  const name = cleanOptionalString(
    sameGroup ? startingName.slice(5) : startingName,
  );
  const amount = parseAmount(
    getValueFromBody(body, "amount", existingEntry?.amount),
  );
  const date = normalizeDateInput(
    getValueFromBody(body, "date", existingEntry?.date),
    fallbackDate,
  );
  const categoryValue = cleanOptionalString(
    getValueFromBody(body, "category", existingEntry?.category),
  );
  const subcategoryValue = cleanOptionalString(
    getValueFromBody(body, "subcategory", existingEntry?.subcategory, [
      "subCategory",
    ]),
  );
  const accountValue = cleanOptionalString(
    getValueFromBody(body, "account", existingEntry?.account),
  );
  const notesValue = cleanOptionalString(
    getValueFromBody(body, "notes", existingEntry?.notes),
  );
  const entryKindValue = cleanOptionalString(
    getValueFromBody(body, "entryKind", existingEntry?.entryKind, ["kind"]),
  );
  const counterpartyValue = cleanOptionalString(
    getValueFromBody(body, "counterparty", existingEntry?.counterparty, [
      "paidTo",
      "paidBy",
    ]),
  );
  let commentsValue = cleanOptionalString(
    getValueFromBody(body, "comments", existingEntry?.comments),
  );

  if (!name) {
    return { error: "name is required" };
  }

  if (amount === null) {
    return { error: "amount must be a number greater than 0" };
  }

  if (!date) {
    return { error: "date must be a valid date" };
  }

  const entryKind =
    type === "expense"
      ? (entryKindValue ?? existingEntry?.entryKind ?? "Regular")
      : (entryKindValue ?? null);

  if (
    type === "expense" &&
    entryKind &&
    (PARTIAL_REIMBURSEMENT_TYPES.has(entryKind.toLowerCase()) ||
      PARTIAL_SHARED_PAYMENT_TYPES.has(entryKind.toLowerCase())) &&
    !commentsValue
  ) {
    commentsValue = "[] payed [amount] | [] pays them back [amount]";
  }

  const allocationMonths =
    type === "income"
      ? normalizeAllocationMonths(
          getValueFromBody(
            body,
            "allocationMonths",
            existingEntry?.allocationMonths,
            ["monthYear", "monthLabel", "allocationMonthsText"],
          ),
          date,
        )
      : [getMonthLabelFromDate(date)];

  const entryCode =
    existingEntry?.entryCode ??
    (sameGroup
      ? (() => {
          const recentEntryCode = getMostRecentEntryCode(existingEntries, type);

          if (!recentEntryCode) {
            return getNextEntryCode(existingEntries, type);
          }

          const parsedRecentCode = parseEntryCode(recentEntryCode);

          return parsedRecentCode
            ? getNextSplitEntryCode(
                existingEntries,
                type,
                parsedRecentCode.canonical,
              )
            : getNextEntryCode(existingEntries, type);
        })()
      : getNextEntryCode(existingEntries, type));

  return {
    entry: {
      id: existingEntry?.id ?? createId(),
      type,
      name,
      amount,
      category: categoryValue,
      subcategory: subcategoryValue,
      date,
      account: accountValue,
      notes: notesValue,
      entryKind,
      counterparty: counterpartyValue,
      comments: commentsValue,
      entryCode,
      allocationMonths,
      linkedRecurringRuleId: cleanOptionalString(
        getValueFromBody(
          body,
          "linkedRecurringRuleId",
          existingEntry?.linkedRecurringRuleId,
        ),
      ),
      recurringOccurrenceKey: cleanOptionalString(
        getValueFromBody(
          body,
          "recurringOccurrenceKey",
          existingEntry?.recurringOccurrenceKey,
        ),
      ),
      createdAt: fallbackCreatedAt,
      updatedAt: timestamp,
    },
  };
}

export function validateMonth(month) {
  return /^\d{4}-\d{2}$/.test(month);
}

export function buildProfileFromBody(body, existingProfile) {
  const fullName = cleanRequiredString(
    getValueFromBody(body, "fullName", existingProfile.fullName),
  );
  const email = normalizeEmail(
    getValueFromBody(body, "email", existingProfile.email),
  );
  const pictureUrl = cleanOptionalString(
    getValueFromBody(body, "pictureUrl", existingProfile.pictureUrl, [
      "picture",
    ]),
  );

  if (!fullName) {
    return { error: "full name is required" };
  }

  const ageInput = getValueFromBody(body, "age", existingProfile.age);
  const age = normalizeAge(ageInput);

  if (
    ageInput !== undefined &&
    ageInput !== null &&
    ageInput !== "" &&
    age === null
  ) {
    return { error: "age must be a whole number between 0 and 130" };
  }

  return {
    profile: {
      ...existingProfile,
      fullName,
      email,
      age,
      pictureUrl,
      updatedAt: new Date().toISOString(),
    },
  };
}

function getNextRecurringOccurrence(
  rule,
  now = new Date(),
  existingEntries = [],
) {
  const intervalMonths = parseRecurringIntervalMonths(rule.frequency);
  const start = new Date(`${rule.startDate}T00:00:00`);
  const startingMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let offset = 0; offset < 48; offset += intervalMonths) {
    const month = new Date(
      startingMonth.getFullYear(),
      startingMonth.getMonth() + offset,
      1,
    );
    const dueDate = buildOccurrenceDate(
      month.getFullYear(),
      month.getMonth(),
      rule.dayOfMonth,
    );
    const dueDateKey = formatLocalDateKey(dueDate);

    if (dueDateKey < rule.startDate) {
      continue;
    }

    if (
      dueDate >= today &&
      !existingEntries.some(
        (entry) =>
          entry.recurringOccurrenceKey ===
          buildOccurrenceKey(rule.id, dueDateKey),
      )
    ) {
      return dueDateKey;
    }
  }

  return null;
}

function getRecurringRuleResponses(userStore, now = new Date()) {
  const existingEntries = userStore.entries;

  return [...userStore.recurringRules]
    .map((rule) => {
      const intervalMonths = parseRecurringIntervalMonths(rule.frequency);
      const generatedEntries = existingEntries.filter(
        (entry) => entry.linkedRecurringRuleId === rule.id,
      );
      const lastTriggeredAt =
        generatedEntries.length > 0
          ? sortEntries(generatedEntries)[0].date
          : null;
      const nextTriggerDate = isRecurringRuleActive(rule)
        ? getNextRecurringOccurrence(rule, now, existingEntries)
        : null;

      return {
        ...rule,
        intervalMonths,
        lastTriggeredAt,
        nextTriggerDate,
        triggeredCount: generatedEntries.length,
      };
    })
    .sort((left, right) => {
      const leftActive = isRecurringRuleActive(left);
      const rightActive = isRecurringRuleActive(right);

      if (leftActive !== rightActive) {
        return leftActive ? -1 : 1;
      }

      if (left.nextTriggerDate && right.nextTriggerDate) {
        return left.nextTriggerDate.localeCompare(right.nextTriggerDate);
      }

      if (left.nextTriggerDate) {
        return -1;
      }

      if (right.nextTriggerDate) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export function buildReferenceData(userStore) {
  const entryAccounts = userStore.entries.map((entry) => entry.account);
  const defaultAccounts = userStore.defaults.accounts.map(
    (account) => account.name,
  );
  const categoryValues = {
    expense: new Set(
      userStore.defaults.categories.expense.map((category) => category.name),
    ),
    income: new Set(
      userStore.defaults.categories.income.map((category) => category.name),
    ),
  };
  const subcategoryValues = {
    expense: {},
    income: {},
  };
  const counterpartyValues = {
    expense: new Set(DEFAULT_COUNTERPARTY_SUGGESTIONS.expense),
    income: new Set(DEFAULT_COUNTERPARTY_SUGGESTIONS.income),
  };
  const expenseKindValues = new Set(
    userStore.defaults.expenseKinds.map((kind) => kind.name),
  );

  userStore.defaults.categories.expense.forEach((category) => {
    subcategoryValues.expense[category.name] = uniqueSortedStrings(
      category.subcategories.map((subcategory) => subcategory.name),
    );
  });

  userStore.defaults.categories.income.forEach((category) => {
    subcategoryValues.income[category.name] = uniqueSortedStrings(
      category.subcategories.map((subcategory) => subcategory.name),
    );
  });

  userStore.recurringRules.forEach((rule) => {
    if (rule.counterparty) {
      counterpartyValues[rule.type].add(rule.counterparty);
    }
  });

  userStore.entries.forEach((entry) => {
    if (entry.category) {
      categoryValues[entry.type].add(entry.category);
    }

    if (entry.category && entry.subcategory) {
      const currentTypeGroups = subcategoryValues[entry.type];
      const existingValues = currentTypeGroups[entry.category] ?? [];
      currentTypeGroups[entry.category] = uniqueSortedStrings([
        ...existingValues,
        entry.subcategory,
      ]);
    }

    if (entry.counterparty) {
      counterpartyValues[entry.type].add(entry.counterparty);
    }

    if (entry.type === "expense" && entry.entryKind) {
      expenseKindValues.add(entry.entryKind);
    }
  });

  return {
    accounts: uniqueSortedStrings([...defaultAccounts, ...entryAccounts]),
    categories: {
      expense: [...categoryValues.expense].sort((left, right) =>
        left.localeCompare(right),
      ),
      income: [...categoryValues.income].sort((left, right) =>
        left.localeCompare(right),
      ),
    },
    subcategories: {
      expense: Object.fromEntries(
        Object.entries(subcategoryValues.expense).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      income: Object.fromEntries(
        Object.entries(subcategoryValues.income).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    },
    expenseKinds: [...expenseKindValues].sort((left, right) =>
      left.localeCompare(right),
    ),
    counterparties: {
      expense: [...counterpartyValues.expense].sort((left, right) =>
        left.localeCompare(right),
      ),
      income: [...counterpartyValues.income].sort((left, right) =>
        left.localeCompare(right),
      ),
    },
  };
}

export function applyRecurringRules(userStore, now = new Date()) {
  const existingOccurrenceKeys = new Set(
    userStore.entries
      .map((entry) => entry.recurringOccurrenceKey)
      .filter(Boolean),
  );
  const createdEntries = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  userStore.recurringRules.forEach((rule) => {
    if (!isRecurringRuleActive(rule)) {
      return;
    }

    const intervalMonths = parseRecurringIntervalMonths(rule.frequency);
    const start = new Date(`${rule.startDate}T00:00:00`);
    const startingMonth = new Date(start.getFullYear(), start.getMonth(), 1);

    for (let offset = 0; offset < 36; offset += intervalMonths) {
      const month = new Date(
        startingMonth.getFullYear(),
        startingMonth.getMonth() + offset,
        1,
      );
      const dueDate = buildOccurrenceDate(
        month.getFullYear(),
        month.getMonth(),
        rule.dayOfMonth,
      );

      if (dueDate > today) {
        break;
      }

      const dueDateKey = formatLocalDateKey(dueDate);

      if (dueDateKey < rule.startDate) {
        continue;
      }

      const occurrenceKey = buildOccurrenceKey(rule.id, dueDateKey);

      if (existingOccurrenceKeys.has(occurrenceKey)) {
        continue;
      }

      const result = buildEntryFromBody(
        {
          type: rule.type,
          name: rule.name,
          amount: rule.amount,
          date: dueDateKey,
          category: rule.category,
          account: rule.account,
          notes: rule.notes,
          entryKind: rule.type === "expense" ? rule.entryKind : null,
          counterparty: rule.counterparty,
          comments: `Triggered automatically on ${now.toISOString().slice(0, 10)}`,
          recurringRuleId: rule.id,
          recurringOccurrenceKey: occurrenceKey,
        },
        {
          forcedType: rule.type,
          existingEntries: [...userStore.entries, ...createdEntries],
          now: now.toISOString(),
        },
      );

      if ("error" in result) {
        continue;
      }

      createdEntries.push(result.entry);
      existingOccurrenceKeys.add(occurrenceKey);
    }
  });

  if (createdEntries.length) {
    userStore.entries.push(...createdEntries);
  }

  return {
    changed: createdEntries.length > 0,
    createdEntries,
    triggeredRuleIds: [
      ...new Set(
        createdEntries
          .map((entry) => entry.linkedRecurringRuleId)
          .filter(Boolean),
      ),
    ],
  };
}

export function buildRecurringRunResponse(recurringResult) {
  return {
    createdCount: recurringResult.createdEntries.length,
    createdEntries: recurringResult.createdEntries,
    triggeredRuleIds: recurringResult.triggeredRuleIds.filter(Boolean),
  };
}

function getExpenseKindKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getEvenUpContribution(entry) {
  const kind = getExpenseKindKey(entry.entryKind);

  if (REIMBURSEMENT_TYPES.has(kind)) {
    return {
      getBackAmount: entry.amount,
      halfGetBackAmount: 0,
      giveBackAmount: 0,
      halfGiveBackAmount: 0,
    };
  }

  if (PARTIAL_REIMBURSEMENT_TYPES.has(kind)) {
    return {
      getBackAmount: 0,
      halfGetBackAmount: entry.amount,
      giveBackAmount: 0,
      halfGiveBackAmount: 0,
    };
  }

  if (SHARED_PAYMENT_TYPES.has(kind)) {
    return {
      getBackAmount: 0,
      halfGetBackAmount: 0,
      giveBackAmount: entry.amount,
      halfGiveBackAmount: 0,
    };
  }

  if (PARTIAL_SHARED_PAYMENT_TYPES.has(kind)) {
    return {
      getBackAmount: 0,
      halfGetBackAmount: 0,
      giveBackAmount: 0,
      halfGiveBackAmount: entry.amount,
    };
  }

  return {
    getBackAmount: 0,
    halfGetBackAmount: 0,
    giveBackAmount: 0,
    halfGiveBackAmount: 0,
  };
}

function buildImportantDate(item, today = new Date()) {
  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(`${item.date}T00:00:00`);
  const daysUntil = Math.round(
    (target.getTime() - current.getTime()) / 86400000,
  );

  return {
    ...item,
    daysUntil,
    isPast: daysUntil < 0,
  };
}

function buildEvenUpRecord(record, userStore) {
  const periodEntries = userStore.entries.filter(
    (entry) =>
      entry.type === "expense" &&
      entry.date >= record.startDate &&
      entry.date <= record.endDate,
  );
  const totals = periodEntries.reduce(
    (summary, entry) => {
      const contribution = getEvenUpContribution(entry);
      summary.getBackAmount += contribution.getBackAmount;
      summary.halfGetBackAmount += contribution.halfGetBackAmount;
      summary.giveBackAmount += contribution.giveBackAmount;
      summary.halfGiveBackAmount += contribution.halfGiveBackAmount;
      return summary;
    },
    {
      getBackAmount: 0,
      halfGetBackAmount: 0,
      giveBackAmount: 0,
      halfGiveBackAmount: 0,
    },
  );
  const amount = Number(
    (
      totals.getBackAmount +
      totals.halfGetBackAmount * 0.5 -
      totals.giveBackAmount -
      totals.halfGiveBackAmount * 0.5
    ).toFixed(2),
  );
  const remaining = Number(Math.max(0, amount - record.paid).toFixed(2));

  return {
    ...record,
    getBackAmount: Number(totals.getBackAmount.toFixed(2)),
    halfGetBackAmount: Number(totals.halfGetBackAmount.toFixed(2)),
    giveBackAmount: Number(totals.giveBackAmount.toFixed(2)),
    halfGiveBackAmount: Number(totals.halfGiveBackAmount.toFixed(2)),
    amount,
    remaining,
  };
}

export function getAccountUsageCount(userStore, accountName) {
  return userStore.entries.filter((entry) => entry.account === accountName)
    .length;
}

function getCategoryUsageCount(userStore, type, categoryName) {
  return userStore.entries.filter(
    (entry) => entry.type === type && entry.category === categoryName,
  ).length;
}

export function getSubcategoryUsageCount(
  userStore,
  type,
  categoryName,
  subcategoryName,
) {
  return userStore.entries.filter(
    (entry) =>
      entry.type === type &&
      entry.category === categoryName &&
      entry.subcategory === subcategoryName,
  ).length;
}

export function getExpenseKindUsageCount(userStore, entryKindName) {
  return userStore.entries.filter(
    (entry) => entry.type === "expense" && entry.entryKind === entryKindName,
  ).length;
}

export function buildDefaultCategoryResponse(userStore, category) {
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

export function buildDefaultsOverview(userStore) {
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
      .sort(
        (left, right) => Math.abs(left.daysUntil) - Math.abs(right.daysUntil),
      ),
    bills: [...userStore.bills].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    notepad: userStore.notepad,
  };
}

export function buildDashboard(userStore, month = getCurrentMonth()) {
  const entries = filterEntries(userStore, { month });
  const totals = {
    income: 0,
    expenses: 0,
    net: 0,
  };
  const counts = {
    income: 0,
    expenses: 0,
  };
  const categoryTotals = {
    expense: {},
    income: {},
  };

  entries.forEach((entry) => {
    if (entry.type === "income") {
      totals.income += entry.amount;
      counts.income += 1;
    } else {
      totals.expenses += entry.amount;
      counts.expenses += 1;
    }

    if (entry.category) {
      const currentCategory = categoryTotals[entry.type][entry.category] ?? {
        category: entry.category,
        total: 0,
        count: 0,
      };

      currentCategory.total += entry.amount;
      currentCategory.count += 1;
      categoryTotals[entry.type][entry.category] = currentCategory;
    }
  });

  totals.income = Number(totals.income.toFixed(2));
  totals.expenses = Number(totals.expenses.toFixed(2));
  totals.net = Number((totals.income - totals.expenses).toFixed(2));

  const recurringRules = getRecurringRuleResponses(userStore);
  const evenUpRecords = userStore.evenUpRecords
    .map((record) => buildEvenUpRecord(record, userStore))
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
  const importantDates = [...userStore.importantDates]
    .map((item) => buildImportantDate(item))
    .sort(
      (left, right) => Math.abs(left.daysUntil) - Math.abs(right.daysUntil),
    );
  const generatedThisMonth = userStore.entries.filter(
    (entry) =>
      entry.linkedRecurringRuleId && entry.date.startsWith(`${month}-`),
  ).length;
  const nextRule = recurringRules.find((rule) => rule.nextTriggerDate);
  const upcomingCount = recurringRules.filter((rule) => {
    if (!rule.nextTriggerDate) {
      return false;
    }

    const nextDate = new Date(`${rule.nextTriggerDate}T00:00:00`);
    const diffDays = Math.round((nextDate.getTime() - Date.now()) / 86400000);
    return diffDays <= 14;
  }).length;
  const outstanding = evenUpRecords.reduce((sum, record) => {
    if (record.status.toLowerCase() === "completed") {
      return sum;
    }

    return sum + record.remaining;
  }, 0);

  return {
    month,
    totals,
    counts,
    entries,
    recentEntries: entries.slice(0, 10),
    expenseEntries: entries.filter((entry) => entry.type === "expense"),
    incomeEntries: entries.filter((entry) => entry.type === "income"),
    categoryBreakdown: {
      expense: Object.values(categoryTotals.expense)
        .map((category) => ({
          ...category,
          total: Number(category.total.toFixed(2)),
        }))
        .sort((left, right) => right.total - left.total),
      income: Object.values(categoryTotals.income)
        .map((category) => ({
          ...category,
          total: Number(category.total.toFixed(2)),
        }))
        .sort((left, right) => right.total - left.total),
    },
    recurringRules,
    evenUpRecords,
    importantDates,
    recurringSummary: {
      activeCount: recurringRules.filter((rule) => isRecurringRuleActive(rule))
        .length,
      upcomingCount,
      generatedThisMonth,
      nextRuleName: nextRule?.name ?? null,
      nextTriggerDate: nextRule?.nextTriggerDate ?? null,
    },
    evenUpSummary: {
      openCount: evenUpRecords.filter(
        (record) => record.status.toLowerCase() !== "completed",
      ).length,
      outstanding: Number(outstanding.toFixed(2)),
    },
  };
}
