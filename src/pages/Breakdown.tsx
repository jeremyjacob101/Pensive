import { MultiSelectFilterDropdown } from "../components/MultiSelectFilterDropdown";
import { formatMonthYearLabel, formatRangeLabel } from "../helpers/dates";
import { formatMoney, getEffectiveAmount } from "../helpers/formatters";
import { useSingleMonthScope } from "../hooks/useSingleMonthScope";
import { useMemo, useState, useEffect, useCallback } from "react";
import { MonthNavigator } from "../components/MonthNavigator";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { toOptionValues } from "../helpers/options";
import { api } from "../../convex/_generated/api";
import { useQuery } from "convex/react";

type PersistedDateState = {
  mode?: "month" | "custom";
  activeMonth?: string | null;
  customStart?: string;
  customEnd?: string;
};

type ParsedDateState = {
  mode: "month" | "custom";
  activeMonth: string | null;
  customRange: { startDate: string; endDate: string } | null;
};

const DATE_STATE_KEY = "breakdown:state:date:v1";
const EXPENSE_ACCOUNT_DESELECTED_KEY =
  "breakdown:filter:deselected:expenseAccounts:v1";
const INCOMING_ACCOUNT_DESELECTED_KEY =
  "breakdown:filter:deselected:incomingAccounts:v1";
const EXPENSE_TYPE_DESELECTED_KEY =
  "breakdown:filter:deselected:expenseType:v1";
const EXPENSE_CATEGORY_DESELECTED_KEY =
  "breakdown:filter:deselected:expenseCategory:v1";
const INCOMING_TYPE_DESELECTED_KEY =
  "breakdown:filter:deselected:incomingType:v1";

const BREAKDOWN_STORAGE_KEYS = [
  DATE_STATE_KEY,
  EXPENSE_ACCOUNT_DESELECTED_KEY,
  INCOMING_ACCOUNT_DESELECTED_KEY,
  EXPENSE_TYPE_DESELECTED_KEY,
  EXPENSE_CATEGORY_DESELECTED_KEY,
  INCOMING_TYPE_DESELECTED_KEY,
] as const;

function parseStoredList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseDateState(value: string): ParsedDateState {
  try {
    const parsed = JSON.parse(value) as PersistedDateState;
    const requestedCustomMode = parsed.mode === "custom";
    const activeMonth =
      typeof parsed.activeMonth === "string" &&
      /^\d{4}-\d{2}$/.test(parsed.activeMonth)
        ? parsed.activeMonth
        : null;
    const customStart =
      typeof parsed.customStart === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.customStart)
        ? parsed.customStart
        : "";
    const customEnd =
      typeof parsed.customEnd === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.customEnd)
        ? parsed.customEnd
        : "";

    return {
      mode:
        requestedCustomMode && customStart && customEnd ? "custom" : "month",
      activeMonth,
      customRange:
        customStart && customEnd
          ? {
              startDate: customStart,
              endDate: customEnd,
            }
          : null,
    };
  } catch {
    return { mode: "month" as const, activeMonth: null, customRange: null };
  }
}

function maxMonth(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function minMonth(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function Breakdown() {
  const [storedDateState, setStoredDateState] = useLocalStorage(
    DATE_STATE_KEY,
    "{}",
  );
  const [storedExpenseAccountDeselected, setStoredExpenseAccountDeselected] =
    useLocalStorage(EXPENSE_ACCOUNT_DESELECTED_KEY, "[]");
  const [storedIncomingAccountDeselected, setStoredIncomingAccountDeselected] =
    useLocalStorage(INCOMING_ACCOUNT_DESELECTED_KEY, "[]");
  const [storedExpenseTypeDeselected, setStoredExpenseTypeDeselected] =
    useLocalStorage(EXPENSE_TYPE_DESELECTED_KEY, "[]");
  const [storedExpenseCategoryDeselected, setStoredExpenseCategoryDeselected] =
    useLocalStorage(EXPENSE_CATEGORY_DESELECTED_KEY, "[]");
  const [storedIncomingTypeDeselected, setStoredIncomingTypeDeselected] =
    useLocalStorage(INCOMING_TYPE_DESELECTED_KEY, "[]");

  const initialDateState = useMemo(
    () => parseDateState(storedDateState),
    [storedDateState],
  );

  const userOptions = useQuery(api.userOptions.list);
  const expenseMonthBounds = useQuery(api.expenses.monthBounds);
  const incomingMonthBounds = useQuery(api.incomings.monthBounds);

  const monthBounds = useMemo(() => {
    if (expenseMonthBounds === undefined || incomingMonthBounds === undefined) {
      return undefined;
    }

    return {
      newestMonth: maxMonth(
        expenseMonthBounds.newestMonth,
        incomingMonthBounds.newestMonth,
      ),
      oldestMonth: minMonth(
        expenseMonthBounds.oldestMonth,
        incomingMonthBounds.oldestMonth,
      ),
    };
  }, [expenseMonthBounds, incomingMonthBounds]);

  const {
    mode,
    scope,
    activeMonth,
    canGoPrevious,
    canGoNext,
    canJumpToOldest,
    canJumpToNewest,
    goToPreviousMonth,
    goToNextMonth,
    jumpToOldest,
    jumpToNewest,
    applyCustomRange,
    resetToNewestMonth,
  } = useSingleMonthScope(monthBounds, initialDateState);

  const scopeArgs =
    scope.startDate && scope.endDate
      ? {
          startDate: scope.startDate,
          endDate: scope.endDate,
          includeMonthYearOverlapOutsideDate: true,
          targetMonths: scope.targetMonths,
        }
      : "skip";

  const scopedExpenses = useQuery(api.expenses.listByDateScope, scopeArgs);
  const scopedIncomings = useQuery(api.incomings.listByDateScope, scopeArgs);

  const expenses = useMemo(() => scopedExpenses ?? [], [scopedExpenses]);
  const incomings = useMemo(() => scopedIncomings ?? [], [scopedIncomings]);

  const [customStart, setCustomStart] = useState(
    initialDateState.customRange?.startDate ?? "",
  );
  const [customEnd, setCustomEnd] = useState(
    initialDateState.customRange?.endDate ?? "",
  );
  const customStartValue =
    mode === "custom" && !customStart ? scope.startDate : customStart;
  const customEndValue =
    mode === "custom" && !customEnd ? scope.endDate : customEnd;

  const rangeLabelText =
    mode === "custom"
      ? formatRangeLabel(scope.startDate, scope.endDate, false)
      : activeMonth
        ? formatRangeLabel(`${activeMonth}-01`, `${activeMonth}-01`, true)
        : "";

  const persistedDateJson = useMemo(() => {
    const payload: PersistedDateState = {
      mode,
      activeMonth,
      customStart: mode === "custom" ? scope.startDate : undefined,
      customEnd: mode === "custom" ? scope.endDate : undefined,
    };
    return JSON.stringify(payload);
  }, [activeMonth, mode, scope.endDate, scope.startDate]);

  useEffect(() => {
    if (storedDateState !== persistedDateJson) {
      setStoredDateState(persistedDateJson);
    }
  }, [persistedDateJson, setStoredDateState, storedDateState]);

  const expenseCategoryLabel = useCallback(
    (row: { category: string; subcategory?: string }) =>
      row.subcategory?.trim()
        ? `${row.category} / ${row.subcategory}`
        : row.category,
    [],
  );

  const incomingTypeLabel = useCallback(
    (row: { incomeType: string; incomeSubtype?: string }) =>
      row.incomeSubtype?.trim()
        ? `${row.incomeType} / ${row.incomeSubtype}`
        : row.incomeType,
    [],
  );

  const expenseAccountOptions = useMemo(() => {
    const globalAccounts = toOptionValues(userOptions?.account)
      .map((value) => value.trim())
      .filter(Boolean);
    const scopedAccounts = expenses
      .map((row) => row.account.trim())
      .filter(Boolean);
    return [...new Set([...globalAccounts, ...scopedAccounts])].sort();
  }, [expenses, userOptions?.account]);

  const incomingAccountOptions = useMemo(() => {
    const globalAccounts = toOptionValues(userOptions?.account)
      .map((value) => value.trim())
      .filter(Boolean);
    const scopedAccounts = incomings
      .map((row) => row.account.trim())
      .filter(Boolean);
    return [...new Set([...globalAccounts, ...scopedAccounts])].sort();
  }, [incomings, userOptions?.account]);

  const expenseTypeOptions = useMemo(() => {
    const globalTypes = toOptionValues(userOptions?.expenseType)
      .map((value) => value.trim())
      .filter(Boolean);
    const scopedTypes = expenses.map((row) => row.type.trim()).filter(Boolean);
    return [...new Set([...globalTypes, ...scopedTypes])].sort();
  }, [expenses, userOptions?.expenseType]);

  const expenseCategoryOptions = useMemo(() => {
    const categories = toOptionValues(userOptions?.category)
      .map((value) => value.trim())
      .filter(Boolean);
    const subcategories = userOptions?.subcategory ?? [];
    const globalLabels = [
      ...categories,
      ...subcategories
        .map((option) => {
          const sub = option.value.trim();
          if (!sub) return "";
          const parent = option.parentValue?.trim() ?? "";
          return parent ? `${parent} / ${sub}` : sub;
        })
        .filter(Boolean),
    ];

    const scopedLabels = expenses.map((row) => expenseCategoryLabel(row));
    return [...new Set([...globalLabels, ...scopedLabels])].sort();
  }, [
    expenseCategoryLabel,
    expenses,
    userOptions?.category,
    userOptions?.subcategory,
  ]);

  const incomingTypeOptions = useMemo(() => {
    const incomeTypes = toOptionValues(userOptions?.incomeType)
      .map((value) => value.trim())
      .filter(Boolean);
    const incomeSubtypes = userOptions?.incomeSubtype ?? [];
    const globalLabels = [
      ...incomeTypes,
      ...incomeSubtypes
        .map((option) => {
          const subtype = option.value.trim();
          if (!subtype) return "";
          const parent = option.parentValue?.trim() ?? "";
          return parent ? `${parent} / ${subtype}` : subtype;
        })
        .filter(Boolean),
    ];

    const scopedLabels = incomings.map((row) => incomingTypeLabel(row));
    return [...new Set([...globalLabels, ...scopedLabels])].sort();
  }, [
    incomingTypeLabel,
    incomings,
    userOptions?.incomeSubtype,
    userOptions?.incomeType,
  ]);

  const expenseAccountDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedExpenseAccountDeselected)),
    [storedExpenseAccountDeselected],
  );
  const incomingAccountDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedIncomingAccountDeselected)),
    [storedIncomingAccountDeselected],
  );
  const expenseTypeDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedExpenseTypeDeselected)),
    [storedExpenseTypeDeselected],
  );
  const expenseCategoryDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedExpenseCategoryDeselected)),
    [storedExpenseCategoryDeselected],
  );
  const incomingTypeDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedIncomingTypeDeselected)),
    [storedIncomingTypeDeselected],
  );

  const selectedExpenseAccounts = useMemo(
    () =>
      expenseAccountOptions.filter(
        (value) => !expenseAccountDeselectedSet.has(value),
      ),
    [expenseAccountDeselectedSet, expenseAccountOptions],
  );
  const selectedIncomingAccounts = useMemo(
    () =>
      incomingAccountOptions.filter(
        (value) => !incomingAccountDeselectedSet.has(value),
      ),
    [incomingAccountDeselectedSet, incomingAccountOptions],
  );
  const selectedExpenseTypes = useMemo(
    () =>
      expenseTypeOptions.filter(
        (value) => !expenseTypeDeselectedSet.has(value),
      ),
    [expenseTypeDeselectedSet, expenseTypeOptions],
  );
  const selectedExpenseCategories = useMemo(
    () =>
      expenseCategoryOptions.filter(
        (value) => !expenseCategoryDeselectedSet.has(value),
      ),
    [expenseCategoryDeselectedSet, expenseCategoryOptions],
  );
  const selectedIncomingTypes = useMemo(
    () =>
      incomingTypeOptions.filter(
        (value) => !incomingTypeDeselectedSet.has(value),
      ),
    [incomingTypeDeselectedSet, incomingTypeOptions],
  );

  const selectedExpenseAccountSet = useMemo(
    () => new Set(selectedExpenseAccounts),
    [selectedExpenseAccounts],
  );
  const selectedIncomingAccountSet = useMemo(
    () => new Set(selectedIncomingAccounts),
    [selectedIncomingAccounts],
  );
  const selectedExpenseTypeSet = useMemo(
    () => new Set(selectedExpenseTypes),
    [selectedExpenseTypes],
  );
  const selectedExpenseCategorySet = useMemo(
    () => new Set(selectedExpenseCategories),
    [selectedExpenseCategories],
  );
  const selectedIncomingTypeSet = useMemo(
    () => new Set(selectedIncomingTypes),
    [selectedIncomingTypes],
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (row) =>
          selectedExpenseAccountSet.has(row.account) &&
          selectedExpenseTypeSet.has(row.type) &&
          selectedExpenseCategorySet.has(expenseCategoryLabel(row)),
      ),
    [
      expenseCategoryLabel,
      expenses,
      selectedExpenseAccountSet,
      selectedExpenseCategorySet,
      selectedExpenseTypeSet,
    ],
  );

  const filteredIncomings = useMemo(
    () =>
      incomings.filter(
        (row) =>
          selectedIncomingAccountSet.has(row.account) &&
          selectedIncomingTypeSet.has(incomingTypeLabel(row)),
      ),
    [
      incomings,
      incomingTypeLabel,
      selectedIncomingAccountSet,
      selectedIncomingTypeSet,
    ],
  );

  const monthlyBuckets = useMemo(() => {
    const months = scope.targetMonths;
    const targetSet = new Set(months);
    const monthMap = new Map(
      months.map((month) => [
        month,
        {
          month,
          incomings: 0,
          expenses: 0,
          savings: 0,
        },
      ]),
    );

    const addAmount = (
      kind: "expense" | "incoming",
      row: {
        amount: number;
        effectiveAmount?: number;
        monthYears?: string[];
        date: string;
      },
    ) => {
      const effectiveAmount = getEffectiveAmount(row);
      const rowMonths = row.monthYears ?? [];

      if (rowMonths.length > 0) {
        const perMonth = effectiveAmount / rowMonths.length;
        for (const month of rowMonths) {
          if (!targetSet.has(month)) continue;
          const bucket = monthMap.get(month);
          if (!bucket) continue;
          if (kind === "expense") {
            bucket.expenses += perMonth;
          } else {
            bucket.incomings += perMonth;
          }
        }
        return;
      }

      const rowMonth = row.date.slice(0, 7);
      if (!targetSet.has(rowMonth)) return;
      const bucket = monthMap.get(rowMonth);
      if (!bucket) return;
      if (kind === "expense") {
        bucket.expenses += effectiveAmount;
      } else {
        bucket.incomings += effectiveAmount;
      }
    };

    for (const row of filteredExpenses) {
      addAmount("expense", row);
    }

    for (const row of filteredIncomings) {
      addAmount("incoming", row);
    }

    const rows = months.map((month) => {
      const bucket = monthMap.get(month) ?? {
        month,
        incomings: 0,
        expenses: 0,
        savings: 0,
      };
      return {
        ...bucket,
        savings: bucket.incomings - bucket.expenses,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.incomings += row.incomings;
        acc.expenses += row.expenses;
        acc.savings += row.savings;
        return acc;
      },
      { incomings: 0, expenses: 0, savings: 0 },
    );

    return { rows, totals };
  }, [filteredExpenses, filteredIncomings, scope.targetMonths]);

  const monthlyAverageTotals = useMemo(() => {
    const monthCount = Math.max(1, monthlyBuckets.rows.length);
    return {
      incomings: monthlyBuckets.totals.incomings / monthCount,
      expenses: monthlyBuckets.totals.expenses / monthCount,
      savings: monthlyBuckets.totals.savings / monthCount,
    };
  }, [monthlyBuckets.rows.length, monthlyBuckets.totals]);

  const isLoading =
    monthBounds === undefined ||
    scopeArgs === "skip" ||
    scopedExpenses === undefined ||
    scopedIncomings === undefined;

  const applyCustomScope = () => {
    if (
      !customStartValue ||
      !customEndValue ||
      customStartValue > customEndValue
    ) {
      return;
    }
    applyCustomRange(customStartValue, customEndValue);
  };

  const resetBreakdown = () => {
    setStoredExpenseAccountDeselected("[]");
    setStoredIncomingAccountDeselected("[]");
    setStoredExpenseTypeDeselected("[]");
    setStoredExpenseCategoryDeselected("[]");
    setStoredIncomingTypeDeselected("[]");
    setStoredDateState("{}");

    if (typeof window !== "undefined") {
      for (const key of BREAKDOWN_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }

    setCustomStart("");
    setCustomEnd("");
    resetToNewestMonth();
  };

  if (isLoading) {
    return <p>Loading breakdown...</p>;
  }

  return (
    <div className="entries-with-month">
      <aside className="month-indicator-area">
        <div className="breakdown-filter-panel">
          <div className="breakdown-filter-header">
            <h3>Breakdown</h3>
            <button
              type="button"
              className="split-entry-launcher breakdown-reset-btn"
              onClick={resetBreakdown}
            >
              Reset Breakdown
            </button>
          </div>

          <div className="breakdown-filter-group">
            <div className="breakdown-filter-group-title">Expenses</div>
            <div className="left-filter-toolbar">
              <MultiSelectFilterDropdown
                label="Expense Account"
                options={expenseAccountOptions}
                selected={selectedExpenseAccounts}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredExpenseAccountDeselected(
                    JSON.stringify(
                      expenseAccountOptions.filter(
                        (value) => !nextSet.has(value),
                      ),
                    ),
                  );
                }}
              />
              <MultiSelectFilterDropdown
                label="Expense Type"
                options={expenseTypeOptions}
                selected={selectedExpenseTypes}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredExpenseTypeDeselected(
                    JSON.stringify(
                      expenseTypeOptions.filter((value) => !nextSet.has(value)),
                    ),
                  );
                }}
              />
              <MultiSelectFilterDropdown
                label="Category/Subcategory"
                options={expenseCategoryOptions}
                selected={selectedExpenseCategories}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredExpenseCategoryDeselected(
                    JSON.stringify(
                      expenseCategoryOptions.filter(
                        (value) => !nextSet.has(value),
                      ),
                    ),
                  );
                }}
              />
            </div>
          </div>

          <div className="breakdown-filter-group">
            <div className="breakdown-filter-group-title">Incomings</div>
            <div className="left-filter-toolbar">
              <MultiSelectFilterDropdown
                label="Incoming Account"
                options={incomingAccountOptions}
                selected={selectedIncomingAccounts}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredIncomingAccountDeselected(
                    JSON.stringify(
                      incomingAccountOptions.filter(
                        (value) => !nextSet.has(value),
                      ),
                    ),
                  );
                }}
              />
              <MultiSelectFilterDropdown
                label="Type/Subtype"
                options={incomingTypeOptions}
                selected={selectedIncomingTypes}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredIncomingTypeDeselected(
                    JSON.stringify(
                      incomingTypeOptions.filter(
                        (value) => !nextSet.has(value),
                      ),
                    ),
                  );
                }}
              />
            </div>
          </div>
        </div>

        <MonthNavigator
          activeMonth={activeMonth}
          mode={mode}
          customRangeLabel={rangeLabelText}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          canJumpToOldest={canJumpToOldest}
          canJumpToNewest={canJumpToNewest}
          onPrevious={goToPreviousMonth}
          onNext={goToNextMonth}
          onJumpToOldest={jumpToOldest}
          onJumpToNewest={jumpToNewest}
        />

        <div className="breakdown-range-panel">
          <div className="breakdown-range-title">Custom Range</div>
          <label>
            From
            <input
              type="date"
              value={customStartValue}
              onChange={(event) => setCustomStart(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={customEndValue}
              onChange={(event) => setCustomEnd(event.target.value)}
            />
          </label>
          <div className="breakdown-range-actions">
            <button
              type="button"
              className="split-entry-launcher"
              onClick={applyCustomScope}
              disabled={
                !customStartValue ||
                !customEndValue ||
                customStartValue > customEndValue
              }
            >
              Apply Range
            </button>
            <button
              type="button"
              className="split-entry-launcher"
              onClick={() => {
                setCustomStart("");
                setCustomEnd("");
                resetToNewestMonth();
              }}
            >
              This Month
            </button>
          </div>
        </div>
      </aside>

      <div className="entry-card-list breakdown-content">
        <div className="breakdown-totals-grid">
          <div className="breakdown-total-card incoming">
            <span className="breakdown-total-label">Total Incomings</span>
            <div className="breakdown-total-value-row">
              <span className="breakdown-total-value">
                {formatMoney(monthlyBuckets.totals.incomings)}
              </span>
              <span className="breakdown-total-avg">
                {formatMoney(monthlyAverageTotals.incomings)} /month
              </span>
            </div>
          </div>
          <div className="breakdown-total-card expense">
            <span className="breakdown-total-label">Total Expenses</span>
            <div className="breakdown-total-value-row">
              <span className="breakdown-total-value">
                {formatMoney(monthlyBuckets.totals.expenses)}
              </span>
              <span className="breakdown-total-avg">
                {formatMoney(monthlyAverageTotals.expenses)} /month
              </span>
            </div>
          </div>
          <div
            className={`breakdown-total-card savings${
              monthlyBuckets.totals.savings < 0 ? " negative" : ""
            }`}
          >
            <span className="breakdown-total-label">Total Savings</span>
            <div className="breakdown-total-value-row">
              <span className="breakdown-total-value">
                {formatMoney(monthlyBuckets.totals.savings)}
              </span>
              <span className="breakdown-total-avg">
                {formatMoney(monthlyAverageTotals.savings)} /month
              </span>
            </div>
          </div>
        </div>

        <div className="breakdown-monthly-card">
          <div className="breakdown-monthly-header">Per Month</div>
          <table className="breakdown-monthly-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Incomings</th>
                <th>Expenses</th>
                <th>Savings</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBuckets.rows.map((row) => (
                <tr key={row.month}>
                  <td>{formatMonthYearLabel(`${row.month}-01`)}</td>
                  <td>{formatMoney(row.incomings)}</td>
                  <td>{formatMoney(row.expenses)}</td>
                  <td className={row.savings < 0 ? "negative" : "positive"}>
                    {formatMoney(row.savings)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>{formatMoney(monthlyBuckets.totals.incomings)}</th>
                <th>{formatMoney(monthlyBuckets.totals.expenses)}</th>
                <th
                  className={
                    monthlyBuckets.totals.savings < 0 ? "negative" : "positive"
                  }
                >
                  {formatMoney(monthlyBuckets.totals.savings)}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}