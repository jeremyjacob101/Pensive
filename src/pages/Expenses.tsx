import { formatMoney, getEffectiveAmount, getProportionalEffectiveDisplay } from "../helpers/formatters";
import { EXPENSE_ACCOUNT_DESELECTED_KEY, EXPENSE_CATEGORY_DESELECTED_KEY } from "../keys/expenses";
import { handleDeleteExpense, handleStartEditExpense, handleUpdateExpense } from "./actions";
import { formatRangeLabel, formatShortDisplayDate, parseMonthYears } from "../helpers/dates";
import { getOptionColor, getScopedOptionValues, toOptionValues } from "../helpers/options";
import { MultiSelectFilterDropdown } from "../components/MultiSelectFilterDropdown";
import { EffectiveAmountControls } from "../components/EffectiveAmountControls";
import { ExpensePaybackLinkManager } from "../components/PaybackLinkManager";
import { MonthYearMultiSelect } from "../components/MonthYearMultiSelect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScopeCalendarButton } from "../components/ScopeCalendarButton";
import { RangePieChartPanel } from "../components/RangePieChartPanel";
import { EditableRowActions } from "../components/EditableRowActions";
import { useSingleMonthScope } from "../hooks/useSingleMonthScope";
import { MonthNavigator } from "../components/MonthNavigator";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { OptionPicker } from "../components/OptionPicker";
import type { TopRowSearchState } from "../types/search";
import { parseStoredList } from "../helpers/storage";
import { useMutation, useQuery } from "convex/react";
import type { EditValues } from "../types/workspace";
import { useOutletContext } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { parseSubId } from "../helpers/subId";
import { CreditCard } from "lucide-react";
import { createPortal } from "react-dom";
import { saveOption } from "./actions";

export function Expenses() {
  const {
    expenseSearchQuery,
    expenseSelectedSearchFields,
    setVisibleExpenseIds,
    setVisibleExpenseCategories,
  } = useOutletContext<TopRowSearchState>();
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );
  const [isMonthYearsSectionOpen, setIsMonthYearsSectionOpen] = useState(false);
  const [isDateOnlySectionOpen, setIsDateOnlySectionOpen] = useState(false);
  const [partnerPickAnchorId, setPartnerPickAnchorId] =
    useState<Id<"expenses"> | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);

  const updateExpense = useMutation(api.expenses.update);
  const deleteExpense = useMutation(api.expenses.remove);
  const addPartnerExpense = useMutation(api.expenses.addPartnerExpense);
  const unlinkExpenseFromPartners = useMutation(
    api.expenses.unlinkExpenseFromPartners,
  );
  const renameBaseExpense = useMutation(api.expenses.renameBaseExpense);
  const removeBaseExpense = useMutation(api.expenses.removeBaseExpense);
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);
  const monthBounds = useQuery(api.expenses.monthBounds);
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
  } = useSingleMonthScope(monthBounds);

  const scopeArgs =
    scope.startDate && scope.endDate
      ? {
          startDate: scope.startDate,
          endDate: scope.endDate,
          includeMonthYearOverlapOutsideDate: mode === "month",
          targetMonths: scope.targetMonths,
        }
      : "skip";
  const rangeLabelText =
    mode === "custom"
      ? formatRangeLabel(scope.startDate, scope.endDate, false)
      : activeMonth
        ? formatRangeLabel(`${activeMonth}-01`, `${activeMonth}-01`, true)
        : "";

  const scopedExpenses = useQuery(api.expenses.listByDateScope, scopeArgs);
  const expenses = useMemo(() => scopedExpenses ?? [], [scopedExpenses]);
  const isLoadingExpenses =
    scopeArgs === "skip" || scopedExpenses === undefined;
  const hasAnyExpenses = expenses.length > 0;
  const [storedAccountDeselected, setStoredAccountDeselected] = useLocalStorage(
    EXPENSE_ACCOUNT_DESELECTED_KEY,
    "[]",
  );
  const [storedCategoryDeselected, setStoredCategoryDeselected] =
    useLocalStorage(EXPENSE_CATEGORY_DESELECTED_KEY, "[]");

  const expenseCategoryLabel = useCallback(
    (row: { category: string; subcategory?: string }) =>
      row.subcategory?.trim()
        ? `${row.category} / ${row.subcategory}`
        : row.category,
    [],
  );

  const accountOptions = useMemo(() => {
    const globalAccounts = toOptionValues(userOptions?.account)
      .map((value) => value.trim())
      .filter(Boolean);
    const scopedAccounts = expenses
      .map((row) => row.account.trim())
      .filter(Boolean);
    return [...new Set([...globalAccounts, ...scopedAccounts])].sort();
  }, [expenses, userOptions?.account]);
  const categoryOptions = useMemo(() => {
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

  const accountDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedAccountDeselected)),
    [storedAccountDeselected],
  );
  const categoryDeselectedSet = useMemo(
    () => new Set(parseStoredList(storedCategoryDeselected)),
    [storedCategoryDeselected],
  );
  const selectedAccounts = useMemo(
    () => accountOptions.filter((value) => !accountDeselectedSet.has(value)),
    [accountDeselectedSet, accountOptions],
  );
  const selectedCategories = useMemo(
    () => categoryOptions.filter((value) => !categoryDeselectedSet.has(value)),
    [categoryDeselectedSet, categoryOptions],
  );
  const selectedAccountSet = useMemo(
    () => new Set(selectedAccounts),
    [selectedAccounts],
  );
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategories),
    [selectedCategories],
  );
  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (row) =>
          selectedAccountSet.has(row.account) &&
          selectedCategorySet.has(expenseCategoryLabel(row)),
      ),
    [expenses, expenseCategoryLabel, selectedAccountSet, selectedCategorySet],
  );
  const normalizedSearchQuery = useMemo(
    () => expenseSearchQuery.trim().toLowerCase(),
    [expenseSearchQuery],
  );
  const searchFilteredExpenses = useMemo(() => {
    if (!normalizedSearchQuery) return filteredExpenses;
    if (expenseSelectedSearchFields.length === 0) return [];
    return filteredExpenses.filter((row) =>
      expenseSelectedSearchFields.some((field) => {
        const value =
          (field === "expense"
            ? row.expense
            : field === "paidTo"
              ? row.paidTo
              : field === "category"
                ? row.category
                : field === "subcategory"
                  ? row.subcategory
                  : field === "type"
                    ? row.type
                    : field === "account"
                      ? row.account
                      : field === "notes"
                        ? row.notes
                        : field === "comments"
                          ? row.comments
                          : field === "baseExpenseLabel"
                            ? row.baseExpenseLabel
                            : "") ?? "";
        return value.toLowerCase().includes(normalizedSearchQuery);
      }));
  }, [expenseSelectedSearchFields, filteredExpenses, normalizedSearchQuery]);
  useEffect(() => {
    setVisibleExpenseIds(searchFilteredExpenses.map((row) => row._id));
    setVisibleExpenseCategories([
      ...new Set(searchFilteredExpenses.map((row) => row.category)),
    ]);
  }, [
    searchFilteredExpenses,
    setVisibleExpenseCategories,
    setVisibleExpenseIds,
  ]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const monthOverlapSet = useMemo(
    () => new Set(scope.targetMonths),
    [scope.targetMonths],
  );
  const activeDateRange = useMemo(
    () =>
      scope.startDate && scope.endDate
        ? { start: scope.startDate, end: scope.endDate }
        : null,
    [scope.endDate, scope.startDate],
  );

  const getRowMatchState = useCallback(
    (row: { date: string; monthYears?: string[] }) => {
      if (mode === "custom") return "full";
      if (!activeDateRange) return "full";
      const dateInRange =
        row.date >= activeDateRange.start && row.date <= activeDateRange.end;
      const monthYearsOverlap = (row.monthYears ?? []).some((month) =>
        monthOverlapSet.has(month));
      if (dateInRange && monthYearsOverlap) return "full";
      if (!dateInRange && monthYearsOverlap) return "monthYearsOnly";
      if (dateInRange && !monthYearsOverlap) return "dateOnly";
      return "full";
    },
    [activeDateRange, mode, monthOverlapSet],
  );

  const getRowMatchDisclaimer = useCallback(
    (row: { date: string; monthYears?: string[] }) => {
      if (mode === "custom") return null;
      const matchState = getRowMatchState(row);
      if (matchState === "monthYearsOnly") {
        return "applied this month/s, paid in different month";
      }
      if (matchState === "dateOnly") {
        return "paid this month, applied to different month/s";
      }
      return null;
    },
    [getRowMatchState, mode],
  );

  const getScopedDisplayAmount = useCallback(
    (row: {
      amount: number;
      effectiveAmount?: number;
      monthYears?: string[];
    }) =>
      mode === "month"
        ? getProportionalEffectiveDisplay(row, scope.targetMonths)
        : {
            totalRowMonths: 1,
            matchingSelectedMonths: 1,
            displayAmount: getEffectiveAmount(row),
            totalEffectiveAmount: getEffectiveAmount(row),
            isPartial: false,
          },
    [mode, scope.targetMonths],
  );

  const displayItems = useMemo(() => {
    const groupedMap = new Map<
      string,
      {
        id: string;
        baseExpenseId: string;
        latestDate: string;
        latestCreation: number;
        totalAmount: number;
        totalEffectiveAmount: number;
        totalDisplayAmount: number;
        rows: typeof searchFilteredExpenses;
      }
    >();

    const soloRows: typeof searchFilteredExpenses = [];

    for (const row of searchFilteredExpenses) {
      const sharedBaseId = (row.baseExpenseId ?? "").trim();
      if (!sharedBaseId) {
        soloRows.push(row);
        continue;
      }

      const existing = groupedMap.get(sharedBaseId);

      if (!existing) {
        groupedMap.set(sharedBaseId, {
          id: `group:${sharedBaseId}`,
          baseExpenseId: sharedBaseId,
          latestDate: row.date,
          latestCreation: row._creationTime,
          totalAmount: row.amount,
          totalEffectiveAmount: getEffectiveAmount(row),
          totalDisplayAmount: getScopedDisplayAmount(row).displayAmount,
          rows: [row],
        });
        continue;
      }

      existing.rows.push(row);
      existing.totalAmount += row.amount;
      existing.totalEffectiveAmount += getEffectiveAmount(row);
      existing.totalDisplayAmount += getScopedDisplayAmount(row).displayAmount;
      if (
        row.date > existing.latestDate ||
        (row.date === existing.latestDate &&
          row._creationTime > existing.latestCreation)
      ) {
        existing.latestDate = row.date;
        existing.latestCreation = row._creationTime;
      }
    }

    const groupedItems = [...groupedMap.values()].map((group) => {
      const groupMatchState = group.rows.some(
        (row) => getRowMatchState(row) === "monthYearsOnly",
      )
        ? "monthYearsOnly"
        : group.rows.some((row) => getRowMatchState(row) === "dateOnly")
          ? "dateOnly"
          : "full";

      return {
        kind: "group" as const,
        id: group.id,
        date: group.latestDate,
        creation: group.latestCreation,
        matchState: groupMatchState,
        group: {
          ...group,
          rows: [...group.rows].sort((a, b) => {
            const subDiff =
              parseSubId(a.subExpenseId) - parseSubId(b.subExpenseId);
            if (subDiff !== 0) return subDiff;
            return a._creationTime - b._creationTime;
          }),
        },
      };
    });

    const soloItems = soloRows.map((row) => ({
      kind: "solo" as const,
      id: `solo:${row._id}`,
      date: row.date,
      creation: row._creationTime,
      matchState: getRowMatchState(row),
      row,
    }));

    const matchStatePriority: Record<string, number> = {
      monthYearsOnly: 0,
      dateOnly: 1,
      full: 2,
    };

    return [...groupedItems, ...soloItems].sort((a, b) => {
      const stateDiff =
        matchStatePriority[a.matchState] - matchStatePriority[b.matchState];
      if (stateDiff !== 0) return stateDiff;
      if (a.date === b.date) {
        return b.creation - a.creation;
      }
      return b.date.localeCompare(a.date);
    });
  }, [getRowMatchState, getScopedDisplayAmount, searchFilteredExpenses]);

  const monthYearsOnlyItems = useMemo(
    () => displayItems.filter((item) => item.matchState === "monthYearsOnly"),
    [displayItems],
  );
  const dateOnlyItems = useMemo(
    () => displayItems.filter((item) => item.matchState === "dateOnly"),
    [displayItems],
  );
  const regularItems = useMemo(
    () => displayItems.filter((item) => item.matchState === "full"),
    [displayItems],
  );
  const renderedListItems = useMemo(() => {
    const items: Array<
      | {
          kind: "section";
          id: "monthYearsOnly" | "dateOnly";
          label: string;
          isOpen: boolean;
          count: number;
        }
      | (typeof displayItems)[number]
    > = [];

    if (monthYearsOnlyItems.length > 0) {
      items.push({
        kind: "section",
        id: "monthYearsOnly",
        label: "Applies to this month, paid in other month/s",
        isOpen: isMonthYearsSectionOpen,
        count: monthYearsOnlyItems.length,
      });
      if (isMonthYearsSectionOpen) {
        items.push(...monthYearsOnlyItems);
      }
    }

    if (dateOnlyItems.length > 0) {
      items.push({
        kind: "section",
        id: "dateOnly",
        label: "Paid this month, applied to other month/s",
        isOpen: isDateOnlySectionOpen,
        count: dateOnlyItems.length,
      });
      if (isDateOnlySectionOpen) {
        items.push(...dateOnlyItems);
      }
    }

    items.push(...regularItems);
    return items;
  }, [
    dateOnlyItems,
    isDateOnlySectionOpen,
    isMonthYearsSectionOpen,
    monthYearsOnlyItems,
    regularItems,
  ]);

  const handlePickPartner = async (partnerId: Id<"expenses">) => {
    if (!partnerPickAnchorId || partnerPickAnchorId === partnerId) return;
    setSaving(true);
    try {
      await addPartnerExpense({
        anchorExpenseId: partnerPickAnchorId,
        partnerExpenseId: partnerId,
      });
      setPartnerPickAnchorId(null);
    } finally {
      setSaving(false);
    }
  };

  const renderPartnerEditor = (row: (typeof expenses)[number]) => {
    const baseId = (row.baseExpenseId ?? "").trim();
    const partnerRows = baseId
      ? expenses.filter(
          (expense) =>
            expense.baseExpenseId === baseId && expense._id !== row._id,
        )
      : [];

    return (
      <div className="partner-editor">
        <div className="partner-editor-header">Partner Expenses</div>
        {partnerRows.length === 0 ? (
          <div className="partner-editor-empty">No partner expenses yet.</div>
        ) : (
          <div className="partner-editor-list">
            {partnerRows.map((partner) => (
              <div key={partner._id} className="partner-editor-row">
                <span>
                  {partner.expense} · ₪{partner.amount.toLocaleString("en-US")}
                </span>
                <button
                  type="button"
                  className="icon-action-btn danger"
                  disabled={saving}
                  onClick={() =>
                    void unlinkExpenseFromPartners({ expenseId: partner._id })
                  }
                >
                  Unpartner
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="partner-editor-actions">
          <button
            type="button"
            className="split-entry-launcher"
            disabled={saving}
            onClick={() => {
              setEditingExpenseId(null);
              setPartnerPickAnchorId(row._id);
            }}
          >
            Add Partner
          </button>
          {baseId ? (
            <button
              type="button"
              className="icon-action-btn danger"
              disabled={saving}
              onClick={() =>
                void unlinkExpenseFromPartners({ expenseId: row._id })
              }
            >
              Unlink This Expense
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      {isLoadingExpenses ? (
        <p>Loading expenses...</p>
      ) : (
        <div className="entries-with-month">
          <aside className="month-indicator-area">
            <div className="left-filter-toolbar">
              <MultiSelectFilterDropdown
                label="Account"
                options={accountOptions}
                selected={selectedAccounts}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredAccountDeselected(
                    JSON.stringify(
                      accountOptions.filter((value) => !nextSet.has(value)),
                    ),
                  );
                }}
              />
              <MultiSelectFilterDropdown
                label="Category/Subcategory"
                options={categoryOptions}
                selected={selectedCategories}
                onChange={(next) => {
                  const nextSet = new Set(next);
                  setStoredCategoryDeselected(
                    JSON.stringify(
                      categoryOptions.filter((value) => !nextSet.has(value)),
                    ),
                  );
                }}
              />
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
            <RangePieChartPanel
              rows={searchFilteredExpenses.map((e) => ({
                monthYears: e.monthYears ?? [],
                effectiveAmount: getEffectiveAmount(e),
                category: e.category,
                subcategory: e.subcategory,
              }))}
              userOptions={userOptions}
              mode={mode}
              startDate={scope.startDate}
              endDate={scope.endDate}
              targetMonths={scope.targetMonths}
              kind="expense"
              onRangeChange={applyCustomRange}
              onMonthsChange={applySelectedMonths}
              onReset={() => {}}
              showScopeControls={false}
              scopeControl={
                <ScopeCalendarButton
                  mode={mode}
                  targetMonths={scope.targetMonths}
                  startDate={scope.startDate}
                  endDate={scope.endDate}
                  monthBounds={monthBounds}
                  onApplyMonths={applySelectedMonths}
                  onApplyCustom={applyCustomRange}
                />
              }
            />
          </aside>

          <div ref={listRef} className="entry-card-list">
            <div
              id="entry-top-controls-anchor"
              className="entry-top-controls-anchor"
            />
            <div className="expense-link-toolbar">
              {partnerPickAnchorId ? (
                <>
                  <div className="partner-pick-banner">
                    Pick an expense row to add as partner
                  </div>
                  <button
                    type="button"
                    className="split-entry-launcher"
                    disabled={saving}
                    onClick={() => setPartnerPickAnchorId(null)}
                  >
                    Cancel Pick
                  </button>
                </>
              ) : null}
            </div>

            {!hasAnyExpenses ? (
              <p>No expenses yet.</p>
            ) : displayItems.length === 0 ? (
              <p>No expenses match current filters/search.</p>
            ) : (
              renderedListItems.map((item) => {
                if (item.kind === "section") {
                  return (
                    <div
                      key={item.id}
                      className="row-match-section-header-wrap"
                    >
                      <button
                        type="button"
                        className="row-match-section-toggle"
                        onClick={() => {
                          if (item.id === "monthYearsOnly") {
                            setIsMonthYearsSectionOpen((prev) => !prev);
                          } else {
                            setIsDateOnlySectionOpen((prev) => !prev);
                          }
                        }}
                        aria-label={
                          item.isOpen ? "Collapse section" : "Expand section"
                        }
                      >
                        <span className="row-match-section-chevron">
                          {item.isOpen ? "▴" : "▾"}
                        </span>
                        <span>{item.label}</span>
                        <span className="row-match-section-count">
                          ({item.count})
                        </span>
                      </button>
                    </div>
                  );
                }
                const shouldShowRowMatchDisclaimer = item.matchState === "full";
                if (item.kind === "group") {
                  const group = item.group;
                  const firstRow = group.rows[0];
                  const groupHasMonthYearsOnly = group.rows.some(
                    (row) => getRowMatchState(row) === "monthYearsOnly",
                  );
                  const groupHasDateOnly = group.rows.some(
                    (row) => getRowMatchState(row) === "dateOnly",
                  );
                  const groupTitle =
                    firstRow?.baseExpenseLabel?.trim() ||
                    firstRow?.expense ||
                    "Shared Expense";
                  const accountColor = getOptionColor(
                    userOptions,
                    "account",
                    firstRow.account,
                  );
                  const typeColor = getOptionColor(
                    userOptions,
                    "expenseType",
                    firstRow.type,
                  );
                  const categoryColor = getOptionColor(
                    userOptions,
                    "category",
                    firstRow.category,
                  );
                  const subcategoryColor = firstRow.subcategory
                    ? getOptionColor(
                        userOptions,
                        "subcategory",
                        firstRow.subcategory,
                      )
                    : null;
                  const dotColor = subcategoryColor ?? categoryColor;
                  const amountTooltip = group.rows
                    .map(
                      (row) =>
                        `${row.expense}: ${formatMoney(row.amount)} raw / ${formatMoney(getEffectiveAmount(row))} effective`,
                    )
                    .join("\n");

                  return (
                    <div
                      key={item.id}
                      data-row-date={item.date}
                      className={`entry-card grouped-expense-card${groupHasMonthYearsOnly ? " row-match-monthYearsOnly" : ""}${groupHasDateOnly ? " row-match-dateOnly" : ""}`}
                    >
                      <div className="entry-card-main grouped-expense-main">
                        <div className="entry-card-primary">
                          <div
                            className="entry-card-amount"
                            title={amountTooltip}
                          >
                            <span
                              className="entry-card-account-icon-wrap"
                              data-tooltip={firstRow.account}
                            >
                              <CreditCard
                                className="entry-card-account-icon"
                                style={{ color: accountColor }}
                                aria-hidden="true"
                              />
                            </span>
                            <span>{formatMoney(group.totalDisplayAmount)}</span>
                          </div>
                          <span
                            className="entry-card-primary-divider"
                            style={{ backgroundColor: typeColor, opacity: 0.8 }}
                            data-tooltip={firstRow.type}
                            aria-hidden="true"
                          />
                          <div className="entry-card-title-wrap">
                            <span className="entry-card-title">
                              {groupTitle}
                            </span>
                            <span
                              className="entry-card-color-dot"
                              style={{ backgroundColor: dotColor }}
                              data-tooltip={
                                firstRow.subcategory
                                  ? `${firstRow.category} / ${firstRow.subcategory}`
                                  : firstRow.category
                              }
                            />
                          </div>
                        </div>

                        <div className="entry-card-date">
                          {formatShortDisplayDate(group.latestDate)}
                        </div>

                        <div className="entry-row-controls">
                          <button
                            type="button"
                            className="icon-action-btn"
                            disabled={saving}
                            aria-label="Rename grouped expense"
                            onClick={() => {
                              const nextName = window
                                .prompt("Rename grouped expense", groupTitle)
                                ?.trim();
                              if (!nextName || nextName === groupTitle) {
                                return;
                              }
                              setSaving(true);
                              void renameBaseExpense({
                                baseExpenseId: group.baseExpenseId,
                                baseExpenseLabel: nextName,
                              }).finally(() => setSaving(false));
                            }}
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            className="icon-action-btn danger"
                            disabled={saving}
                            aria-label="Delete grouped expense"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Delete all ${group.rows.length} sub-expenses in this group?`,
                                )
                              ) {
                                return;
                              }
                              setSaving(true);
                              void removeBaseExpense({
                                baseExpenseId: group.baseExpenseId,
                              }).finally(() => setSaving(false));
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      <div className="entry-card-details grouped-expense-details">
                        {group.rows.map((row, index) => {
                          const isEditing = editingExpenseId === row._id;
                          const proportional = getScopedDisplayAmount(row);
                          const categoryColor = getOptionColor(
                            userOptions,
                            "category",
                            row.category,
                          );
                          const subcategoryColor = row.subcategory
                            ? getOptionColor(
                                userOptions,
                                "subcategory",
                                row.subcategory,
                              )
                            : null;
                          const dotColor = subcategoryColor ?? categoryColor;

                          return (
                            <div
                              key={row._id}
                              className={`grouped-expense-row${index > 0 ? " has-divider" : ""}${partnerPickAnchorId ? " partner-pick-target" : ""}${getRowMatchState(row) === "monthYearsOnly" ? " row-match-monthYearsOnly" : ""}${getRowMatchState(row) === "dateOnly" ? " row-match-dateOnly" : ""}`}
                              onClick={() =>
                                partnerPickAnchorId
                                  ? void handlePickPartner(row._id)
                                  : undefined
                              }
                            >
                              <div className="grouped-expense-row-main">
                                <div className="grouped-expense-row-title-wrap">
                                  {shouldShowRowMatchDisclaimer &&
                                  getRowMatchDisclaimer(row) ? (
                                    <span className="row-match-disclaimer">
                                      {getRowMatchDisclaimer(row)}
                                    </span>
                                  ) : null}
                                  <span className="grouped-expense-row-title">
                                    {row.expense}
                                  </span>
                                  <span
                                    className="entry-card-color-dot"
                                    style={{ backgroundColor: dotColor }}
                                  />
                                </div>
                                <div className="grouped-expense-row-meta">
                                  {row.type} · {row.category}
                                  {row.subcategory
                                    ? ` / ${row.subcategory}`
                                    : ""}{" "}
                                  · {row.account} · {row.paidTo}
                                </div>
                              </div>

                              <div className="grouped-expense-row-amount-date">
                                <span className="grouped-expense-row-amount">
                                  {formatMoney(row.amount)}
                                </span>
                                <span className="grouped-expense-row-effective">
                                  {proportional.isPartial
                                    ? `(${formatMoney(proportional.displayAmount)}) effective`
                                    : `${formatMoney(proportional.displayAmount)} effective`}
                                </span>
                                {proportional.isPartial ? (
                                  <span className="entry-effective-original">
                                    {formatMoney(getEffectiveAmount(row))}{" "}
                                    effective
                                  </span>
                                ) : null}
                                <span className="grouped-expense-row-date">
                                  {formatShortDisplayDate(row.date)}
                                </span>
                              </div>

                              <div className="entry-row-controls grouped-expense-row-controls">
                                <EditableRowActions
                                  isEditing={false}
                                  saving={saving}
                                  onSave={() => {}}
                                  onCancel={() => {}}
                                  onEdit={() =>
                                    handleStartEditExpense(
                                      row,
                                      setEditingExpenseId,
                                      setEditValues,
                                    )
                                  }
                                  onDelete={() =>
                                    handleDeleteExpense(
                                      row,
                                      deleteExpense,
                                      setSaving,
                                    )
                                  }
                                />
                              </div>

                              {isEditing
                                ? createPortal(
                                    <div
                                      className="modal-overlay"
                                      onClick={() => setEditingExpenseId(null)}
                                    >
                                      <div
                                        className="modal-card"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="modal-header">
                                          <h3>Edit Expense</h3>
                                          <button
                                            type="button"
                                            className="modal-close"
                                            onClick={() =>
                                              setEditingExpenseId(null)
                                            }
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <div className="entry-form modal-form">
                                          <input
                                            value={editValues.expense ?? ""}
                                            onChange={(e) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                expense: e.target.value,
                                              }))
                                            }
                                          />
                                          <OptionPicker
                                            kind="expenseType"
                                            label="Expense Type"
                                            value={editValues.type ?? ""}
                                            options={toOptionValues(
                                              userOptions?.expenseType,
                                            )}
                                            placeholder="Type"
                                            onChange={(value) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                type: value,
                                              }))
                                            }
                                            onCreateOption={saveOption.bind(
                                              null,
                                              addUserOption,
                                            )}
                                          />
                                          <OptionPicker
                                            kind="account"
                                            label="Account"
                                            value={editValues.account ?? ""}
                                            options={toOptionValues(
                                              userOptions?.account,
                                            )}
                                            placeholder="Account"
                                            onChange={(value) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                account: value,
                                              }))
                                            }
                                            onCreateOption={saveOption.bind(
                                              null,
                                              addUserOption,
                                            )}
                                          />
                                          <OptionPicker
                                            kind="category"
                                            label="Category"
                                            value={editValues.category ?? ""}
                                            options={toOptionValues(
                                              userOptions?.category,
                                            )}
                                            placeholder="Category"
                                            onChange={(value) =>
                                              setEditValues((v) => {
                                                const next: EditValues = {
                                                  ...v,
                                                  category: value,
                                                };
                                                const scoped =
                                                  getScopedOptionValues(
                                                    userOptions,
                                                    "subcategory",
                                                    value,
                                                  );
                                                if (
                                                  (next.subcategory ?? "") &&
                                                  !scoped.includes(
                                                    next.subcategory ?? "",
                                                  )
                                                ) {
                                                  next.subcategory = "";
                                                }
                                                return next;
                                              })
                                            }
                                            onCreateOption={saveOption.bind(
                                              null,
                                              addUserOption,
                                            )}
                                          />
                                          <OptionPicker
                                            kind="subcategory"
                                            label="Subcategory"
                                            value={editValues.subcategory ?? ""}
                                            options={getScopedOptionValues(
                                              userOptions,
                                              "subcategory",
                                              editValues.category ?? "",
                                            )}
                                            placeholder="Subcategory"
                                            onChange={(value) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                subcategory: value,
                                              }))
                                            }
                                            onCreateOption={saveOption.bind(
                                              null,
                                              addUserOption,
                                            )}
                                            parentValue={
                                              editValues.category ?? ""
                                            }
                                          />
                                          <input
                                            value={editValues.amount ?? ""}
                                            onChange={(e) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                amount: e.target.value,
                                              }))
                                            }
                                          />
                                          <EffectiveAmountControls
                                            editValues={editValues}
                                            setEditValues={setEditValues}
                                          />
                                          <input
                                            type="date"
                                            value={editValues.date ?? ""}
                                            onChange={(e) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                date: e.target.value,
                                              }))
                                            }
                                          />
                                          <MonthYearMultiSelect
                                            value={parseMonthYears(
                                              editValues.monthYears,
                                              editValues.date ?? row.date,
                                            )}
                                            onChange={(value) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                monthYears:
                                                  JSON.stringify(value),
                                              }))
                                            }
                                            required
                                          />
                                          <input
                                            value={editValues.paidTo ?? ""}
                                            onChange={(e) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                paidTo: e.target.value,
                                              }))
                                            }
                                          />
                                          <input
                                            value={editValues.notes ?? ""}
                                            onChange={(e) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                notes: e.target.value,
                                              }))
                                            }
                                          />
                                          <input
                                            value={editValues.comments ?? ""}
                                            onChange={(e) =>
                                              setEditValues((v) => ({
                                                ...v,
                                                comments: e.target.value,
                                              }))
                                            }
                                          />
                                          {renderPartnerEditor(row)}
                                          <ExpensePaybackLinkManager
                                            expenseId={row._id}
                                            disabled={saving}
                                          />
                                          <button
                                            type="button"
                                            className="save-plus-btn"
                                            aria-label="Save expense changes"
                                            disabled={saving}
                                            onClick={() =>
                                              handleUpdateExpense(row, {
                                                updateExpense,
                                                editValues,
                                                setSaving,
                                                setEditingExpenseId,
                                              })
                                            }
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>,
                                    document.body,
                                  )
                                : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const row = item.row;
                const isExpanded = expandedExpenseId === row._id;
                const isEditing = editingExpenseId === row._id;
                const typeColor = getOptionColor(
                  userOptions,
                  "expenseType",
                  row.type,
                );
                const categoryColor = getOptionColor(
                  userOptions,
                  "category",
                  row.category,
                );
                const subcategoryColor = row.subcategory
                  ? getOptionColor(userOptions, "subcategory", row.subcategory)
                  : null;
                const dotColor = subcategoryColor ?? categoryColor;
                const accountColor = getOptionColor(
                  userOptions,
                  "account",
                  row.account,
                );
                const proportional = getScopedDisplayAmount(row);

                return (
                  <div
                    key={item.id}
                    data-row-date={item.date}
                    className={`entry-card${isExpanded ? " is-expanded" : ""}${partnerPickAnchorId ? " partner-pick-target" : ""}${getRowMatchState(row) === "monthYearsOnly" ? " row-match-monthYearsOnly" : ""}${getRowMatchState(row) === "dateOnly" ? " row-match-dateOnly" : ""}`}
                    onClick={() =>
                      partnerPickAnchorId
                        ? void handlePickPartner(row._id)
                        : undefined
                    }
                  >
                    <div className="entry-card-main">
                      <div className="entry-card-primary">
                        <div className="entry-card-amount">
                          <span
                            className="entry-card-account-icon-wrap"
                            data-tooltip={row.account}
                          >
                            <CreditCard
                              className="entry-card-account-icon"
                              style={{ color: accountColor }}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="entry-card-amount-values">
                            <span>
                              {proportional.isPartial
                                ? `(${formatMoney(proportional.displayAmount)})`
                                : formatMoney(proportional.displayAmount)}
                            </span>
                            {proportional.isPartial ? (
                              <span className="entry-effective-original">
                                {formatMoney(getEffectiveAmount(row))}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <span
                          className="entry-card-primary-divider"
                          style={{ backgroundColor: typeColor, opacity: 0.8 }}
                          data-tooltip={row.type}
                          aria-hidden="true"
                        />
                        <div className="entry-card-title-wrap">
                          {shouldShowRowMatchDisclaimer &&
                          getRowMatchDisclaimer(row) ? (
                            <span className="row-match-disclaimer">
                              {getRowMatchDisclaimer(row)}
                            </span>
                          ) : null}
                          <span className="entry-card-title">
                            {row.expense}
                          </span>
                          <span
                            className="entry-card-color-dot"
                            style={{ backgroundColor: dotColor }}
                            data-tooltip={
                              row.subcategory
                                ? `${row.category} / ${row.subcategory}`
                                : row.category
                            }
                          />
                        </div>
                      </div>

                      <div className="entry-card-date">
                        {formatShortDisplayDate(row.date)}
                      </div>

                      <div className="entry-row-controls">
                        <EditableRowActions
                          isEditing={false}
                          saving={saving}
                          onSave={() => {}}
                          onCancel={() => {}}
                          onEdit={() =>
                            handleStartEditExpense(
                              row,
                              setEditingExpenseId,
                              setEditValues,
                            )
                          }
                          onDelete={() =>
                            handleDeleteExpense(row, deleteExpense, setSaving)
                          }
                        />
                        <button
                          type="button"
                          className="icon-action-btn"
                          onClick={() =>
                            setExpandedExpenseId((prev) =>
                              prev === row._id ? null : row._id)
                          }
                          aria-label={
                            isExpanded ? "Collapse row" : "Expand row"
                          }
                        >
                          {isExpanded ? "▴" : "▾"}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="entry-card-details">
                        <div className="entry-detail-grid static">
                          <div>
                            <strong>Type:</strong> {row.type}
                          </div>
                          <div>
                            <strong>Account:</strong> {row.account}
                          </div>
                          <div>
                            <strong>Category:</strong> {row.category}
                          </div>
                          <div>
                            <strong>Subcategory:</strong>{" "}
                            {row.subcategory || "-"}
                          </div>
                          <div>
                            <strong>Paid To:</strong> {row.paidTo}
                          </div>
                          <div>
                            <strong>Months:</strong>{" "}
                            {(row.monthYears ?? [])
                              .map((month) => {
                                const parsed = new Date(`${month}-01T00:00:00`);
                                if (Number.isNaN(parsed.getTime()))
                                  return month;
                                return new Intl.DateTimeFormat("en-US", {
                                  month: "long",
                                  year: "numeric",
                                }).format(parsed);
                              })
                              .join(", ") || "-"}
                          </div>
                          <div>
                            <strong>Amount:</strong> {formatMoney(row.amount)}
                          </div>
                          <div>
                            <strong>Effective:</strong>{" "}
                            {formatMoney(getEffectiveAmount(row))}
                          </div>
                          <div>
                            <strong>Notes:</strong> {row.notes ?? "-"}
                          </div>
                          <div>
                            <strong>Comments:</strong> {row.comments ?? "-"}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isEditing
                      ? createPortal(
                          <div
                            className="modal-overlay"
                            onClick={() => setEditingExpenseId(null)}
                          >
                            <div
                              className="modal-card"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="modal-header">
                                <h3>Edit Expense</h3>
                                <button
                                  type="button"
                                  className="modal-close"
                                  onClick={() => setEditingExpenseId(null)}
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="entry-form modal-form">
                                <input
                                  value={editValues.expense ?? ""}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      expense: e.target.value,
                                    }))
                                  }
                                />
                                <OptionPicker
                                  kind="expenseType"
                                  label="Expense Type"
                                  value={editValues.type ?? ""}
                                  options={toOptionValues(
                                    userOptions?.expenseType,
                                  )}
                                  placeholder="Type"
                                  onChange={(value) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      type: value,
                                    }))
                                  }
                                  onCreateOption={saveOption.bind(
                                    null,
                                    addUserOption,
                                  )}
                                />
                                <OptionPicker
                                  kind="account"
                                  label="Account"
                                  value={editValues.account ?? ""}
                                  options={toOptionValues(userOptions?.account)}
                                  placeholder="Account"
                                  onChange={(value) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      account: value,
                                    }))
                                  }
                                  onCreateOption={saveOption.bind(
                                    null,
                                    addUserOption,
                                  )}
                                />
                                <OptionPicker
                                  kind="category"
                                  label="Category"
                                  value={editValues.category ?? ""}
                                  options={toOptionValues(
                                    userOptions?.category,
                                  )}
                                  placeholder="Category"
                                  onChange={(value) =>
                                    setEditValues((v) => {
                                      const next: EditValues = {
                                        ...v,
                                        category: value,
                                      };
                                      const scoped = getScopedOptionValues(
                                        userOptions,
                                        "subcategory",
                                        value,
                                      );
                                      if (
                                        (next.subcategory ?? "") &&
                                        !scoped.includes(next.subcategory ?? "")
                                      ) {
                                        next.subcategory = "";
                                      }
                                      return next;
                                    })
                                  }
                                  onCreateOption={saveOption.bind(
                                    null,
                                    addUserOption,
                                  )}
                                />
                                <OptionPicker
                                  kind="subcategory"
                                  label="Subcategory"
                                  value={editValues.subcategory ?? ""}
                                  options={getScopedOptionValues(
                                    userOptions,
                                    "subcategory",
                                    editValues.category ?? "",
                                  )}
                                  placeholder="Subcategory"
                                  onChange={(value) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      subcategory: value,
                                    }))
                                  }
                                  onCreateOption={saveOption.bind(
                                    null,
                                    addUserOption,
                                  )}
                                  parentValue={editValues.category ?? ""}
                                />
                                <input
                                  value={editValues.amount ?? ""}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      amount: e.target.value,
                                    }))
                                  }
                                />
                                <EffectiveAmountControls
                                  editValues={editValues}
                                  setEditValues={setEditValues}
                                />
                                <input
                                  type="date"
                                  value={editValues.date ?? ""}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      date: e.target.value,
                                    }))
                                  }
                                />
                                <MonthYearMultiSelect
                                  value={parseMonthYears(
                                    editValues.monthYears,
                                    editValues.date ?? row.date,
                                  )}
                                  onChange={(value) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      monthYears: JSON.stringify(value),
                                    }))
                                  }
                                  required
                                />
                                <input
                                  value={editValues.paidTo ?? ""}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      paidTo: e.target.value,
                                    }))
                                  }
                                />
                                <input
                                  value={editValues.notes ?? ""}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      notes: e.target.value,
                                    }))
                                  }
                                />
                                <input
                                  value={editValues.comments ?? ""}
                                  onChange={(e) =>
                                    setEditValues((v) => ({
                                      ...v,
                                      comments: e.target.value,
                                    }))
                                  }
                                />
                                {renderPartnerEditor(row)}
                                <ExpensePaybackLinkManager
                                  expenseId={row._id}
                                  disabled={saving}
                                />
                                <button
                                  type="button"
                                  className="save-plus-btn"
                                  aria-label="Save expense changes"
                                  disabled={saving}
                                  onClick={() =>
                                    handleUpdateExpense(row, {
                                      updateExpense,
                                      editValues,
                                      setSaving,
                                      setEditingExpenseId,
                                    })
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>,
                          document.body,
                        )
                      : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}