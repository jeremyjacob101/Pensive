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

export const range = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const userId = await requireUserId(ctx);
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate))
      .collect();
    const incomings = await ctx.db
      .query("incomings")
      .withIndex("by_user_id_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate))
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
      const rawAmount = expense.amount;
      const effectiveAmount = getEffectiveAmountFallback(expense);
      const bucket = ensureMonthBucket(buckets, expense.date.slice(0, 7));
      bucket.rawExpenses += rawAmount;
      bucket.effectiveExpenses += effectiveAmount;
      totals.rawExpenses += rawAmount;
      totals.effectiveExpenses += effectiveAmount;
    }

    for (const incoming of incomings) {
      const rawAmount = incoming.amount;
      const effectiveAmount = getEffectiveAmountFallback(incoming);
      const bucket = ensureMonthBucket(buckets, incoming.date.slice(0, 7));
      bucket.rawIncomings += rawAmount;
      bucket.effectiveIncomings += effectiveAmount;
      totals.rawIncomings += rawAmount;
      totals.effectiveIncomings += effectiveAmount;
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