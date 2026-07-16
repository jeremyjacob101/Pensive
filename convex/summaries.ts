import { getEffectiveAmountFallback } from "./paybackHelpers";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { v } from "convex/values";

type SummaryBucket = {
  month: string;
  rawExpenses: number;
  effectiveExpenses: number;
  rawIncomings: number;
  effectiveIncomings: number;
  rawNet: number;
  effectiveNet: number;
};

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

function ensureMonthBucket(buckets: Map<string, SummaryBucket>, month: string) {
  const existing = buckets.get(month);
  if (existing) return existing;

  const created = {
    month,
    rawExpenses: 0,
    effectiveExpenses: 0,
    rawIncomings: 0,
    effectiveIncomings: 0,
    rawNet: 0,
    effectiveNet: 0,
  };
  buckets.set(month, created);
  return created;
}

function monthFromDate(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-/);
  if (!match) return "";
  return `${match[1]}-${match[2]}`;
}

function addMonth(month: string) {
  const [yearText, monthText] = month.split("-");
  let year = Number(yearText);
  let monthNumber = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) return "";
  monthNumber += 1;
  if (monthNumber > 12) {
    year += 1;
    monthNumber = 1;
  }
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function targetMonths(startDate: string, endDate: string) {
  const startMonth = monthFromDate(startDate);
  const endMonth = monthFromDate(endDate);
  if (!startMonth || !endMonth || startMonth > endMonth) return [];

  const months: string[] = [];
  let cursor = startMonth;
  while (cursor && cursor <= endMonth) {
    months.push(cursor);
    cursor = addMonth(cursor);
  }
  return months;
}

function normalizedRowMonths(row: { date: string; monthYears?: string[] }) {
  const months = (row.monthYears ?? []).filter((month) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month));
  if (months.length > 0) return [...new Set(months)].sort();
  const fallback = monthFromDate(row.date);
  return fallback ? [fallback] : [];
}

function addScopedAmount(
  buckets: Map<string, SummaryBucket>,
  totals: Omit<SummaryBucket, "month">,
  row: { date: string; monthYears?: string[]; amount: number },
  effectiveAmount: number,
  kind: "expense" | "incoming",
  targetMonthSet: Set<string>,
) {
  const months = normalizedRowMonths(row);
  const monthCount = Math.max(1, months.length);
  const matchingMonths = months.filter((month) => targetMonthSet.has(month));
  if (matchingMonths.length === 0) return;

  const rawShare = row.amount / monthCount;
  const effectiveShare = effectiveAmount / monthCount;

  for (const month of matchingMonths) {
    const bucket = ensureMonthBucket(buckets, month);
    if (kind === "expense") {
      bucket.rawExpenses += rawShare;
      bucket.effectiveExpenses += effectiveShare;
    } else {
      bucket.rawIncomings += rawShare;
      bucket.effectiveIncomings += effectiveShare;
    }
  }

  const rawAmount = rawShare * matchingMonths.length;
  const scopedEffectiveAmount = effectiveShare * matchingMonths.length;
  if (kind === "expense") {
    totals.rawExpenses += rawAmount;
    totals.effectiveExpenses += scopedEffectiveAmount;
  } else {
    totals.rawIncomings += rawAmount;
    totals.effectiveIncomings += scopedEffectiveAmount;
  }
}

export const range = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await requireUserId(ctx);
    const months = targetMonths(startDate, endDate);
    const targetMonthSet = new Set(months);
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .collect();
    const incomings = await ctx.db
      .query("incomings")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .collect();

    const buckets = new Map<string, SummaryBucket>();
    const totals = {
      rawExpenses: 0,
      effectiveExpenses: 0,
      rawIncomings: 0,
      effectiveIncomings: 0,
      rawNet: 0,
      effectiveNet: 0,
    };

    for (const expense of expenses) {
      const effectiveAmount = getEffectiveAmountFallback(expense);
      addScopedAmount(
        buckets,
        totals,
        expense,
        effectiveAmount,
        "expense",
        targetMonthSet,
      );
    }

    for (const incoming of incomings) {
      const effectiveAmount = getEffectiveAmountFallback(incoming);
      addScopedAmount(
        buckets,
        totals,
        incoming,
        effectiveAmount,
        "incoming",
        targetMonthSet,
      );
    }

    for (const bucket of buckets.values()) {
      bucket.rawNet = bucket.rawIncomings - bucket.rawExpenses;
      bucket.effectiveNet =
        bucket.effectiveIncomings - bucket.effectiveExpenses;
    }
    totals.rawNet = totals.rawIncomings - totals.rawExpenses;
    totals.effectiveNet = totals.effectiveIncomings - totals.effectiveExpenses;

    return {
      startDate,
      endDate,
      totals,
      monthlyBuckets: [...buckets.values()].sort((a, b) =>
        a.month.localeCompare(b.month)),
    };
  },
});