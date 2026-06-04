import type { WarningResult } from "../types/payback";

export function randomId16() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function toAmount(value: string) {
  const cleaned = value.trim().replace(/[^0-9.-]/g, "");
  const n = Number(cleaned || "0");
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: number) {
  return `₪${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatWarnings(result: WarningResult | null | undefined) {
  const warnings = result?.warnings ?? [];
  return warnings.map((warning) => warning.message).join(" ");
}

export function getEffectiveAmount(row: {
  amount: number;
  effectiveAmount?: number;
}) {
  return row.effectiveAmount ?? row.amount;
}

export function getMonthSpanCount(row: { monthYears?: string[] }) {
  return Math.max(1, row.monthYears?.length ?? 0);
}

export function getDisplayEffectiveAmount(row: {
  amount: number;
  effectiveAmount?: number;
  monthYears?: string[];
}) {
  const effective = getEffectiveAmount(row);
  const spanCount = getMonthSpanCount(row);
  return spanCount > 1 ? effective / spanCount : effective;
}

export function getProportionalEffectiveDisplay(
  row: {
    amount: number;
    effectiveAmount?: number;
    monthYears?: string[];
  },
  targetMonths: string[],
) {
  const totalEffectiveAmount = getEffectiveAmount(row);
  const rowMonths = row.monthYears ?? [];
  const totalRowMonths = Math.max(1, rowMonths.length);
  const targetMonthSet = new Set(targetMonths);
  const matchingSelectedMonths = rowMonths.filter((month) =>
    targetMonthSet.has(month)).length;

  const hasMonthYears = rowMonths.length > 0;
  const appliedMatchingMonths = hasMonthYears
    ? matchingSelectedMonths
    : Math.min(1, targetMonths.length);
  const ratio = appliedMatchingMonths / totalRowMonths;
  const displayAmount = totalEffectiveAmount * ratio;
  const isPartial = hasMonthYears && matchingSelectedMonths < totalRowMonths;

  return {
    totalRowMonths,
    matchingSelectedMonths: appliedMatchingMonths,
    displayAmount,
    totalEffectiveAmount,
    isPartial,
  };
}