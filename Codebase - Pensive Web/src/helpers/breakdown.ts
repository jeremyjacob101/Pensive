import type { ParsedDateState, PersistedDateState } from "../types/breakdown";

export function parseDateState(value: string): ParsedDateState {
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

export function maxMonth(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function minMonth(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}