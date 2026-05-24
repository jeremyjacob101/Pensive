import { getMonthFromIsoDate, getMonthStartEndFromMonth, getMonthsInRange, getTodayIsoDate, shiftMonth } from "../helpers/dates";
import { useCallback, useMemo, useState } from "react";

export type MonthScopeMode = "month" | "custom";

export interface DateWindow {
  startDate: string;
  endDate: string;
}

interface MonthBounds {
  newestMonth: string | null;
  oldestMonth: string | null;
}

interface UseSingleMonthScopeInitialState {
  mode?: MonthScopeMode;
  activeMonth?: string | null;
  customRange?: DateWindow | null;
}

function validMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function validIsoDate(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function windowFromMonth(month: string): DateWindow {
  const window = getMonthStartEndFromMonth(month);
  return { startDate: window.start, endDate: window.end };
}

function fallbackCurrentMonth(): string {
  return getMonthFromIsoDate(getTodayIsoDate());
}

export function useSingleMonthScope(
  monthBounds: MonthBounds | undefined,
  initialState?: UseSingleMonthScopeInitialState,
) {
  const [mode, setMode] = useState<MonthScopeMode>(
    initialState?.mode === "custom" ? "custom" : "month",
  );
  const [activeMonth, setActiveMonth] = useState<string | null>(() =>
    validMonth(initialState?.activeMonth) ? initialState?.activeMonth : null);
  const [customRange, setCustomRange] = useState<DateWindow | null>(() => {
    const range = initialState?.customRange;
    if (
      !range ||
      !validIsoDate(range.startDate) ||
      !validIsoDate(range.endDate)
    ) {
      return null;
    }
    return range;
  });

  const newestBoundMonth = monthBounds?.newestMonth;
  const oldestBoundMonth = monthBounds?.oldestMonth;

  const seedMonth = useMemo(() => {
    if (monthBounds === undefined) return null;
    return newestBoundMonth ?? fallbackCurrentMonth();
  }, [monthBounds, newestBoundMonth]);

  const resolvedMonth = activeMonth ?? seedMonth;

  const scope = useMemo(() => {
    if (mode === "custom" && customRange) {
      return {
        startDate: customRange.startDate,
        endDate: customRange.endDate,
        targetMonths: getMonthsInRange(
          customRange.startDate,
          customRange.endDate,
        ),
      };
    }

    if (!validMonth(resolvedMonth)) {
      return { startDate: "", endDate: "", targetMonths: [] as string[] };
    }

    const window = windowFromMonth(resolvedMonth);
    return {
      startDate: window.startDate,
      endDate: window.endDate,
      targetMonths: [resolvedMonth],
    };
  }, [mode, customRange, resolvedMonth]);

  const canGoPrevious = useMemo(() => {
    if (mode !== "month") return false;
    if (!validMonth(resolvedMonth)) return false;
    return !validMonth(oldestBoundMonth) || resolvedMonth > oldestBoundMonth;
  }, [mode, resolvedMonth, oldestBoundMonth]);

  const canGoNext = useMemo(() => {
    if (mode !== "month") return false;
    if (!validMonth(resolvedMonth)) return false;
    return !validMonth(newestBoundMonth) || resolvedMonth < newestBoundMonth;
  }, [mode, resolvedMonth, newestBoundMonth]);

  const canJumpToOldest = useMemo(() => {
    if (mode !== "month") return false;
    return validMonth(oldestBoundMonth) && resolvedMonth !== oldestBoundMonth;
  }, [mode, resolvedMonth, oldestBoundMonth]);

  const canJumpToNewest = useMemo(() => {
    if (mode !== "month") return false;
    return validMonth(newestBoundMonth) && resolvedMonth !== newestBoundMonth;
  }, [mode, resolvedMonth, newestBoundMonth]);

  const goToPreviousMonth = useCallback(() => {
    if (!canGoPrevious || !validMonth(resolvedMonth)) return;
    setMode("month");
    setCustomRange(null);
    setActiveMonth(shiftMonth(resolvedMonth, -1));
  }, [canGoPrevious, resolvedMonth]);

  const goToNextMonth = useCallback(() => {
    if (!canGoNext || !validMonth(resolvedMonth)) return;
    setMode("month");
    setCustomRange(null);
    setActiveMonth(shiftMonth(resolvedMonth, 1));
  }, [canGoNext, resolvedMonth]);

  const jumpToOldest = useCallback(() => {
    if (!canJumpToOldest || !validMonth(oldestBoundMonth)) return;
    setMode("month");
    setCustomRange(null);
    setActiveMonth(oldestBoundMonth);
  }, [canJumpToOldest, oldestBoundMonth]);

  const jumpToNewest = useCallback(() => {
    if (!canJumpToNewest || !validMonth(newestBoundMonth)) return;
    setMode("month");
    setCustomRange(null);
    setActiveMonth(newestBoundMonth);
  }, [canJumpToNewest, newestBoundMonth]);

  const resetToNewestMonth = useCallback(() => {
    const month = validMonth(newestBoundMonth)
      ? newestBoundMonth
      : fallbackCurrentMonth();
    setMode("month");
    setCustomRange(null);
    setActiveMonth(month);
  }, [newestBoundMonth]);

  const applyCustomRange = useCallback((startDate: string, endDate: string) => {
    setMode("custom");
    setCustomRange({ startDate, endDate });
  }, []);

  return {
    mode,
    scope,
    activeMonth: resolvedMonth,
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
  };
}