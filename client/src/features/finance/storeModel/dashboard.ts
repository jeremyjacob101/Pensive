import type {
  CategoryBreakdownItem,
  DashboardResponse,
  Entry,
  EvenUpRecord,
  ImportantDate,
  RecurringRule,
  ReferenceData,
} from "../types";
import { DEFAULT_COUNTERPARTY_SUGGESTIONS } from "../defaultSeeds";
import {
  PARTIAL_REIMBURSEMENT_TYPES,
  PARTIAL_SHARED_PAYMENT_TYPES,
  REIMBURSEMENT_TYPES,
  SHARED_PAYMENT_TYPES,
} from "./constants";
import { getCurrentMonth, uniqueSortedStrings } from "./core";
import { filterEntries, sortEntries } from "./entries";
import type {
  StoredImportantDate,
  StoredEvenUpRecord,
  StoredRecurringRule,
  UserStore,
} from "./storeTypes";

function getExpenseKindKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getEvenUpContribution(entry: Entry) {
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

export function buildImportantDate(
  item: StoredImportantDate,
  today = new Date(),
): ImportantDate {
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

function parseRecurringIntervalMonths(frequency: string) {
  const normalized = frequency.trim().toLowerCase();
  const match = normalized.match(/(\d+)/);

  if (normalized.includes("month")) {
    return Math.max(1, Number(match?.[1] ?? 1));
  }

  return 1;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function buildOccurrenceDate(
  year: number,
  monthIndex: number,
  dayOfMonth: number,
) {
  const safeDay = Math.min(dayOfMonth, getDaysInMonth(year, monthIndex));
  return new Date(year, monthIndex, safeDay);
}

function buildOccurrenceKey(ruleId: string, dueDate: string) {
  return `${ruleId}:${dueDate}`;
}

function getNextRecurringOccurrence(
  rule: StoredRecurringRule,
  now = new Date(),
  existingEntries: Entry[] = [],
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
    const dueDateKey = dueDate.toISOString().slice(0, 10);

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

function getRecurringRuleResponses(userStore: UserStore, now = new Date()) {
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
      const nextTriggerDate = getNextRecurringOccurrence(
        rule,
        now,
        existingEntries,
      );

      return {
        ...rule,
        intervalMonths,
        lastTriggeredAt,
        nextTriggerDate,
        triggeredCount: generatedEntries.length,
      } satisfies RecurringRule;
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status.localeCompare(right.status);
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

export function buildReferenceData(userStore: UserStore): ReferenceData {
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
  const subcategoryValues: ReferenceData["subcategories"] = {
    expense: {},
    income: {},
  };
  const counterpartyValues = {
    expense: new Set<string>(DEFAULT_COUNTERPARTY_SUGGESTIONS.expense),
    income: new Set<string>(DEFAULT_COUNTERPARTY_SUGGESTIONS.income),
  };
  const expenseKindValues = new Set<string>(
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

export function applyRecurringRules(userStore: UserStore, now = new Date()) {
  void userStore;
  void now;

  return {
    changed: false,
    createdEntries: [],
    triggeredRuleIds: [],
  };
}

function buildEvenUpRecord(
  record: StoredEvenUpRecord,
  userStore: UserStore,
): EvenUpRecord {
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

export function buildDashboard(
  userStore: UserStore,
  month = getCurrentMonth(),
): DashboardResponse {
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
  const categoryTotals: Record<
    "expense" | "income",
    Record<string, CategoryBreakdownItem>
  > = {
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
      activeCount: 0,
      upcomingCount: 0,
      generatedThisMonth: 0,
      nextRuleName: null,
      nextTriggerDate: null,
    },
    evenUpSummary: {
      openCount: evenUpRecords.filter(
        (record) => record.status.toLowerCase() !== "completed",
      ).length,
      outstanding: Number(outstanding.toFixed(2)),
    },
  };
}
