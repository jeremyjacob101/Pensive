import { getMonthFromIsoDate, getMonthStartEnd, getMonthStartEndFromMonth, getTodayIsoDate } from "./dates";
import type { DateWindow } from "../types/monthScope";

export function validMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export function validIsoDate(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function windowFromMonth(month: string): DateWindow {
  const window = getMonthStartEndFromMonth(month);
  return { startDate: window.start, endDate: window.end };
}

export function fallbackCurrentMonthWindow(): DateWindow {
  const window = getMonthStartEnd(getTodayIsoDate());
  return { startDate: window.start, endDate: window.end };
}

export function monthFromWindow(window: DateWindow) {
  return window.startDate.slice(0, 7);
}

export function fallbackCurrentMonth(): string {
  return getMonthFromIsoDate(getTodayIsoDate());
}