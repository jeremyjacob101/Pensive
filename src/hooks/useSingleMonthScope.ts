import type { DateWindow, MonthBounds, MonthScopeMode, UseSingleMonthScopeInitialState } from "../types/monthScope";
import { fallbackCurrentMonth, validIsoDate, validMonth, windowFromMonth } from "../helpers/monthScope";
import { getMonthsInRange, shiftMonth } from "../helpers/dates";
import { useCallback, useMemo, useState } from "react";

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
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

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

    const months =
      selectedMonths.length > 0
        ? selectedMonths
        : [resolvedMonth];
    const sortedMonths = [...months].sort((a, b) => a.localeCompare(b));
    const firstMonth = sortedMonths[0] ?? resolvedMonth;
    const lastMonth = sortedMonths[sortedMonths.length - 1] ?? resolvedMonth;
    const startWindow = windowFromMonth(firstMonth);
    const endWindow = windowFromMonth(lastMonth);
    const window = windowFromMonth(resolvedMonth);
    return {
      startDate: startWindow.startDate || window.startDate,
      endDate: endWindow.endDate || window.endDate,
      targetMonths: [...months].sort((a, b) => b.localeCompare(a)),
    };
  }, [mode, customRange, resolvedMonth, selectedMonths]);

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
    const nextMonth = shiftMonth(resolvedMonth, -1);
    setMode("month");
    setCustomRange(null);
    setSelectedMonths(validMonth(nextMonth) ? [nextMonth] : []);
    setActiveMonth(nextMonth);
  }, [canGoPrevious, resolvedMonth]);

  const goToNextMonth = useCallback(() => {
    if (!canGoNext || !validMonth(resolvedMonth)) return;
    const nextMonth = shiftMonth(resolvedMonth, 1);
    setMode("month");
    setCustomRange(null);
    setSelectedMonths(validMonth(nextMonth) ? [nextMonth] : []);
    setActiveMonth(nextMonth);
  }, [canGoNext, resolvedMonth]);

  const jumpToOldest = useCallback(() => {
    if (!canJumpToOldest || !validMonth(oldestBoundMonth)) return;
    setMode("month");
    setCustomRange(null);
    setSelectedMonths([oldestBoundMonth]);
    setActiveMonth(oldestBoundMonth);
  }, [canJumpToOldest, oldestBoundMonth]);

  const jumpToNewest = useCallback(() => {
    if (!canJumpToNewest || !validMonth(newestBoundMonth)) return;
    setMode("month");
    setCustomRange(null);
    setSelectedMonths([newestBoundMonth]);
    setActiveMonth(newestBoundMonth);
  }, [canJumpToNewest, newestBoundMonth]);

  const resetToNewestMonth = useCallback(() => {
    const month = validMonth(newestBoundMonth)
      ? newestBoundMonth
      : fallbackCurrentMonth();
    setMode("month");
    setCustomRange(null);
    setSelectedMonths(validMonth(month) ? [month] : []);
    setActiveMonth(month);
  }, [newestBoundMonth]);

  const applyCustomRange = useCallback((startDate: string, endDate: string) => {
    setMode("custom");
    setCustomRange({ startDate, endDate });
  }, []);

  const applySelectedMonths = useCallback((months: string[]) => {
    const nextMonths = [...months].sort((a, b) => b.localeCompare(a));
    setMode("month");
    setCustomRange(null);
    setSelectedMonths(nextMonths);
    setActiveMonth(nextMonths[0] ?? null);
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
    applySelectedMonths,
    resetToNewestMonth,
  };
}
