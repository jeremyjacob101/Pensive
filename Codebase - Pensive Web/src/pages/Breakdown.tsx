import { DATE_STATE_KEY, EXPENSE_ACCOUNT_DESELECTED_KEY, EXPENSE_CATEGORY_DESELECTED_KEY, INCOMING_ACCOUNT_DESELECTED_KEY, INCOMING_TYPE_DESELECTED_KEY } from "../keys/breakdown";
import { getOptionColor, getScopedOptionColor, toOptionValues } from "../helpers/options";
import { MultiSelectFilterDropdown } from "../components/MultiSelectFilterDropdown";
import { formatMonthYearLabel, formatMonthYearShortLabel, formatRangeLabel, getMonthsBetween } from "../helpers/dates";
import { maxMonth, minMonth, parseDateState } from "../helpers/breakdown";
import { formatMoney, getEffectiveAmount } from "../helpers/formatters";
import { fallbackCurrentMonth, validMonth } from "../helpers/monthScope";
import { useSingleMonthScope } from "../hooks/useSingleMonthScope";
import { useMemo, useState, useEffect, useCallback } from "react";
import { MonthNavigator } from "../components/MonthNavigator";
import type { PersistedDateState } from "../types/breakdown";
import { BREAKDOWN_STORAGE_KEYS } from "../types/breakdown";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { parseStoredList } from "../helpers/storage";
import { api } from "@pensive/convex-api";
import { useQuery } from "convex/react";

type BreakdownFilterSource = "expense" | "incoming";
type BreakdownFilterKind = "account" | "category";

export function Breakdown() {
  const [storedDateState, setStoredDateState] = useLocalStorage(
    DATE_STATE_KEY,
    "{}",
  );
  const [storedExpenseAccountDeselected, setStoredExpenseAccountDeselected] =
    useLocalStorage(EXPENSE_ACCOUNT_DESELECTED_KEY, "[]");
  const [storedIncomingAccountDeselected, setStoredIncomingAccountDeselected] =
    useLocalStorage(INCOMING_ACCOUNT_DESELECTED_KEY, "[]");
  const [storedExpenseCategoryDeselected, setStoredExpenseCategoryDeselected] =
    useLocalStorage(EXPENSE_CATEGORY_DESELECTED_KEY, "[]");
  const [storedIncomingTypeDeselected, setStoredIncomingTypeDeselected] =
    useLocalStorage(INCOMING_TYPE_DESELECTED_KEY, "[]");
  const [activeFilterSource, setActiveFilterSource] =
    useState<BreakdownFilterSource>("expense");
  const [activeFilterKind, setActiveFilterKind] =
    useState<BreakdownFilterKind>("account");
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [draftCustomStart, setDraftCustomStart] = useState("");
  const [draftCustomEnd, setDraftCustomEnd] = useState("");
  const currentMonth = useMemo(() => fallbackCurrentMonth(), []);
  const monthOptions = useMemo(() => {
    const oldest = validMonth(monthBounds?.oldestMonth)
      ? monthBounds.oldestMonth
      : currentMonth;
    const newestFromData = validMonth(monthBounds?.newestMonth)
      ? monthBounds.newestMonth
      : currentMonth;
    const newest =
      newestFromData > currentMonth ? newestFromData : currentMonth;
    const start = oldest <= newest ? oldest : newest;
    const finish = oldest <= newest ? newest : oldest;
    return getMonthsBetween(start, finish).reverse();
  }, [currentMonth, monthBounds]);
  const [draftStartMonth, setDraftStartMonth] = useState(currentMonth);
  const [draftEndMonth, setDraftEndMonth] = useState(currentMonth);

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
    applySelectedMonths,
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
  const expenseAccountFilterOptions = useMemo(
    () =>
      expenseAccountOptions.map((value) => ({
        value,
        color: getOptionColor(userOptions, "account", value),
      })),
    [expenseAccountOptions, userOptions],
  );
  const incomingAccountFilterOptions = useMemo(
    () =>
      incomingAccountOptions.map((value) => ({
        value,
        color: getOptionColor(userOptions, "account", value),
      })),
    [incomingAccountOptions, userOptions],
  );
  const expenseCategoryFilterOptions = useMemo(
    () =>
      expenseCategoryOptions.map((value) => {
        const [parent, child] = value.split(" / ");
        return {
          value,
          color: child
            ? getScopedOptionColor(userOptions, "subcategory", child, parent)
            : getOptionColor(userOptions, "category", value),
        };
      }),
    [expenseCategoryOptions, userOptions],
  );
  const incomingTypeFilterOptions = useMemo(
    () =>
      incomingTypeOptions.map((value) => {
        const [parent, child] = value.split(" / ");
        return {
          value,
          color: child
            ? getScopedOptionColor(userOptions, "incomeSubtype", child, parent)
            : getOptionColor(userOptions, "incomeType", value),
        };
      }),
    [incomingTypeOptions, userOptions],
  );

  useEffect(() => {
    const valid = new Set(expenseAccountOptions);
    const next = parseStoredList(storedExpenseAccountDeselected).filter((
      value,
    ) => valid.has(value));
    if (next.length !== expenseAccountDeselectedSet.size) {
      setStoredExpenseAccountDeselected(JSON.stringify(next));
    }
  }, [
    expenseAccountDeselectedSet.size,
    expenseAccountOptions,
    setStoredExpenseAccountDeselected,
    storedExpenseAccountDeselected,
  ]);
  useEffect(() => {
    const valid = new Set(incomingAccountOptions);
    const next = parseStoredList(storedIncomingAccountDeselected).filter((
      value,
    ) => valid.has(value));
    if (next.length !== incomingAccountDeselectedSet.size) {
      setStoredIncomingAccountDeselected(JSON.stringify(next));
    }
  }, [
    incomingAccountDeselectedSet.size,
    incomingAccountOptions,
    setStoredIncomingAccountDeselected,
    storedIncomingAccountDeselected,
  ]);
  useEffect(() => {
    const valid = new Set(expenseCategoryOptions);
    const next = parseStoredList(storedExpenseCategoryDeselected).filter((
      value,
    ) => valid.has(value));
    if (next.length !== expenseCategoryDeselectedSet.size) {
      setStoredExpenseCategoryDeselected(JSON.stringify(next));
    }
  }, [
    expenseCategoryDeselectedSet.size,
    expenseCategoryOptions,
    setStoredExpenseCategoryDeselected,
    storedExpenseCategoryDeselected,
  ]);
  useEffect(() => {
    const valid = new Set(incomingTypeOptions);
    const next = parseStoredList(storedIncomingTypeDeselected).filter((value) =>
      valid.has(value));
    if (next.length !== incomingTypeDeselectedSet.size) {
      setStoredIncomingTypeDeselected(JSON.stringify(next));
    }
  }, [
    incomingTypeDeselectedSet.size,
    incomingTypeOptions,
    setStoredIncomingTypeDeselected,
    storedIncomingTypeDeselected,
  ]);

  const activeFilterDropdown = useMemo(() => {
    if (activeFilterSource === "expense" && activeFilterKind === "account") {
      return {
        label: "Account",
        options: expenseAccountFilterOptions,
        selected: selectedExpenseAccounts,
        optionValues: expenseAccountOptions,
        onChange: (next: string[]) => {
          const nextSet = new Set(next);
          setStoredExpenseAccountDeselected(
            JSON.stringify(
              expenseAccountOptions.filter((value) => !nextSet.has(value)),
            ),
          );
        },
      };
    }

    if (activeFilterSource === "expense") {
      return {
        label: "Category/Subcategory",
        options: expenseCategoryFilterOptions,
        selected: selectedExpenseCategories,
        optionValues: expenseCategoryOptions,
        onChange: (next: string[]) => {
          const nextSet = new Set(next);
          setStoredExpenseCategoryDeselected(
            JSON.stringify(
              expenseCategoryOptions.filter((value) => !nextSet.has(value)),
            ),
          );
        },
      };
    }

    if (activeFilterKind === "account") {
      return {
        label: "Account",
        options: incomingAccountFilterOptions,
        selected: selectedIncomingAccounts,
        optionValues: incomingAccountOptions,
        onChange: (next: string[]) => {
          const nextSet = new Set(next);
          setStoredIncomingAccountDeselected(
            JSON.stringify(
              incomingAccountOptions.filter((value) => !nextSet.has(value)),
            ),
          );
        },
      };
    }

    return {
      label: "Income Type/Subtype",
      options: incomingTypeFilterOptions,
      selected: selectedIncomingTypes,
      optionValues: incomingTypeOptions,
      onChange: (next: string[]) => {
        const nextSet = new Set(next);
        setStoredIncomingTypeDeselected(
          JSON.stringify(
            incomingTypeOptions.filter((value) => !nextSet.has(value)),
          ),
        );
      },
    };
  }, [
    activeFilterKind,
    activeFilterSource,
    expenseAccountFilterOptions,
    expenseAccountOptions,
    expenseCategoryFilterOptions,
    expenseCategoryOptions,
    incomingAccountFilterOptions,
    incomingAccountOptions,
    incomingTypeFilterOptions,
    incomingTypeOptions,
    selectedExpenseAccounts,
    selectedExpenseCategories,
    selectedIncomingAccounts,
    selectedIncomingTypes,
    setStoredExpenseAccountDeselected,
    setStoredExpenseCategoryDeselected,
    setStoredIncomingAccountDeselected,
    setStoredIncomingTypeDeselected,
  ]);

  const selectedExpenseAccountSet = useMemo(
    () => new Set(selectedExpenseAccounts),
    [selectedExpenseAccounts],
  );
  const selectedIncomingAccountSet = useMemo(
    () => new Set(selectedIncomingAccounts),
    [selectedIncomingAccounts],
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
          selectedExpenseAccountSet.has(row.account.trim()) &&
          selectedExpenseCategorySet.has(expenseCategoryLabel(row)),
      ),
    [
      expenseCategoryLabel,
      expenses,
      selectedExpenseAccountSet,
      selectedExpenseCategorySet,
    ],
  );

  const filteredIncomings = useMemo(
    () =>
      incomings.filter(
        (row) =>
          selectedIncomingAccountSet.has(row.account.trim()) &&
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

  const resetBreakdown = () => {
    setStoredExpenseAccountDeselected("[]");
    setStoredIncomingAccountDeselected("[]");
    setStoredExpenseCategoryDeselected("[]");
    setStoredIncomingTypeDeselected("[]");
    setStoredDateState("{}");

    if (typeof window !== "undefined") {
      for (const key of BREAKDOWN_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }

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

          <div className="breakdown-filter-tabs" aria-label="Breakdown source">
            <button
              type="button"
              className={activeFilterSource === "expense" ? "active" : ""}
              onClick={() => setActiveFilterSource("expense")}
            >
              Expenses
            </button>
            <button
              type="button"
              className={activeFilterSource === "incoming" ? "active" : ""}
              onClick={() => setActiveFilterSource("incoming")}
            >
              Incomings
            </button>
          </div>

          <div className="breakdown-filter-tabs" aria-label="Breakdown filter">
            <button
              type="button"
              className={activeFilterKind === "account" ? "active" : ""}
              onClick={() => setActiveFilterKind("account")}
            >
              Account
            </button>
            <button
              type="button"
              className={activeFilterKind === "category" ? "active" : ""}
              onClick={() => setActiveFilterKind("category")}
            >
              {activeFilterSource === "expense" ? "Category" : "Income Type"}
            </button>
          </div>

          <div className="left-filter-toolbar breakdown-active-filter">
            <MultiSelectFilterDropdown
              label={activeFilterDropdown.label}
              options={activeFilterDropdown.options}
              selected={activeFilterDropdown.selected}
              onChange={activeFilterDropdown.onChange}
            />
            <span className="breakdown-active-filter-count">
              {activeFilterDropdown.selected.length}/
              {activeFilterDropdown.optionValues.length}
            </span>
          </div>
        </div>

        <MonthNavigator
          activeMonth={activeMonth}
          mode={mode}
          customRangeLabel={rangeLabelText}
          targetMonths={scope.targetMonths}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          canJumpToOldest={canJumpToOldest}
          canJumpToNewest={canJumpToNewest}
          onPrevious={goToPreviousMonth}
          onNext={goToNextMonth}
          onJumpToOldest={jumpToOldest}
          onJumpToNewest={jumpToNewest}
        />

        <div className="pie-chart-panel-modes">
          <button
            type="button"
            className={`pie-mode-btn${mode === "month" && !isCustomEditorOpen ? " active" : ""}`}
            onClick={() => {
              setIsCustomEditorOpen(false);
              if (mode === "custom") {
                resetToNewestMonth();
              }
              const sorted = [...scope.targetMonths].sort((a, b) => a.localeCompare(b));
              setDraftStartMonth(sorted[0] ?? currentMonth);
              setDraftEndMonth(sorted[sorted.length - 1] ?? currentMonth);
            }}
          >
            Months
          </button>
          <button
            type="button"
            className={`pie-mode-btn${isCustomEditorOpen || mode === "custom" ? " active" : ""}`}
            onClick={() => {
              setIsCustomEditorOpen(true);
              setDraftCustomStart(scope.startDate);
              setDraftCustomEnd(scope.endDate);
            }}
          >
            Custom
          </button>
        </div>

        {(isCustomEditorOpen || mode === "custom") ? (
          <div className="pie-chart-panel-dates">
            <label className="pie-date-field">
              From
              <input
                type="date"
                value={draftCustomStart}
                onChange={(e) => setDraftCustomStart(e.target.value)}
              />
            </label>
            <label className="pie-date-field">
              To
              <input
                type="date"
                value={draftCustomEnd}
                onChange={(e) => setDraftCustomEnd(e.target.value)}
              />
            </label>
            <div className="pie-date-actions">
              <button
                type="button"
                className="pie-apply-btn"
                disabled={!draftCustomStart || !draftCustomEnd || draftCustomStart > draftCustomEnd}
                onClick={() => {
                  applyCustomRange(draftCustomStart, draftCustomEnd);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div className="scope-calendar-panel">
            <label>
              Start Month
              <select
                value={draftStartMonth}
                onChange={(event) => setDraftStartMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={`start-${month}`} value={month}>
                    {formatMonthYearShortLabel(`${month}-01`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              End Month
              <select
                value={draftEndMonth}
                onChange={(event) => setDraftEndMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={`end-${month}`} value={month}>
                    {formatMonthYearShortLabel(`${month}-01`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="scope-calendar-actions">
              <button
                type="button"
                className="scope-calendar-apply"
                disabled={!draftStartMonth || !draftEndMonth || draftStartMonth > draftEndMonth}
                onClick={() => {
                  if (!draftStartMonth || !draftEndMonth || draftStartMonth > draftEndMonth) return;
                  applySelectedMonths(
                    getMonthsBetween(draftStartMonth, draftEndMonth),
                  );
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}
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