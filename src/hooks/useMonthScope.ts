import { fallbackCurrentMonthWindow, monthFromWindow, validMonth, windowFromMonth } from "../helpers/monthScope";
import { getMonthFromIsoDate, getMonthsInRange, getTodayIsoDate, shiftMonth } from "../helpers/dates";
import type { DateWindow, MonthBounds, MonthScopeMode } from "../types/monthScope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type { DateWindow, MonthScopeMode } from "../types/monthScope";

export function useMonthScope(monthBounds: MonthBounds | undefined) {
  const [mode, setMode] = useState<MonthScopeMode>("month");
  const [selectedWindows, setSelectedWindows] = useState<DateWindow[]>([]);
  const [customRange, setCustomRange] = useState<DateWindow | null>(null);
  const loadingMoreRef = useRef(false);

  const newestBoundMonth = monthBounds?.newestMonth;
  const oldestBoundMonth = monthBounds?.oldestMonth;
  const seedMonth =
    monthBounds === undefined
      ? null
      : (newestBoundMonth ?? getMonthFromIsoDate(getTodayIsoDate()));

  const seedWindow = useMemo(() => {
    if (!validMonth(seedMonth)) return null;
    const initialWindow = windowFromMonth(seedMonth);
    return initialWindow.startDate && initialWindow.endDate
      ? initialWindow
      : null;
  }, [seedMonth]);

  const activeSelectedWindows = useMemo(() => {
    if (selectedWindows.length > 0) return selectedWindows;
    return seedWindow ? [seedWindow] : [];
  }, [seedWindow, selectedWindows]);

  const activeSelectedWindowCount = activeSelectedWindows.length;

  useEffect(() => {
    loadingMoreRef.current = false;
  }, [activeSelectedWindowCount]);

  const resetToNewestMonth = useCallback(() => {
    const month = validMonth(newestBoundMonth)
      ? newestBoundMonth
      : getMonthFromIsoDate(getTodayIsoDate());
    const nextWindow = validMonth(month)
      ? windowFromMonth(month)
      : fallbackCurrentMonthWindow();

    setMode("month");
    setCustomRange(null);
    setSelectedWindows(
      nextWindow.startDate && nextWindow.endDate ? [nextWindow] : [],
    );
    loadingMoreRef.current = false;
  }, [newestBoundMonth]);

  const applyCustomRange = useCallback((startDate: string, endDate: string) => {
    setMode("custom");
    setCustomRange({ startDate, endDate });
    loadingMoreRef.current = false;
  }, []);

  const selectedMonths = useMemo(
    () =>
      activeSelectedWindows
        .map(monthFromWindow)
        .filter(validMonth)
        .sort((a, b) => b.localeCompare(a)),
    [activeSelectedWindows],
  );

  const oldestLoadedMonth = selectedMonths[selectedMonths.length - 1] ?? "";

  const canAppendPreviousMonth = useMemo(() => {
    if (mode !== "month") return false;
    if (!validMonth(oldestLoadedMonth)) return false;
    return (
      !validMonth(oldestBoundMonth) || oldestLoadedMonth > oldestBoundMonth
    );
  }, [mode, oldestBoundMonth, oldestLoadedMonth]);

  const appendPreviousMonth = useCallback(
    (monthOverride?: string | null) => {
      if (!canAppendPreviousMonth || loadingMoreRef.current) return;

      const previousMonth = validMonth(monthOverride)
        ? monthOverride
        : shiftMonth(oldestLoadedMonth, -1);
      if (!validMonth(previousMonth)) return;
      if (selectedMonths.includes(previousMonth)) return;

      const previousWindow = windowFromMonth(previousMonth);
      if (!previousWindow.startDate || !previousWindow.endDate) return;

      loadingMoreRef.current = true;
      setSelectedWindows([previousWindow]);
    },
    [canAppendPreviousMonth, oldestLoadedMonth, selectedMonths],
  );

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

    const starts = activeSelectedWindows
      .map((window) => window.startDate)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const ends = activeSelectedWindows
      .map((window) => window.endDate)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return {
      startDate: starts[0] ?? "",
      endDate: ends[ends.length - 1] ?? "",
      targetMonths: selectedMonths,
    };
  }, [activeSelectedWindows, customRange, mode, selectedMonths]);

  return {
    mode,
    scope,
    oldestLoadedMonth,
    canAppendPreviousMonth,
    appendPreviousMonth,
    applyCustomRange,
    resetToNewestMonth,
  };
}