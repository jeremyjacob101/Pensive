import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

function needsEffectiveBackfill(row: {
  amount: number;
  effectiveAmount?: number;
  effectiveAmountMode?: string;
}) {
  return (
    typeof row.effectiveAmount !== "number" ||
    (row.effectiveAmountMode !== "auto" && row.effectiveAmountMode !== "manual")
  );
}

export const backfill = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }) => {
    const userId = await requireUserId(ctx);
    const limit = batchSize ?? 200;
    const [expenses, incomings] = await Promise.all([
      ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    let expensesUpdated = 0;
    let incomingsUpdated = 0;
    const expensesNeedingBackfill = expenses.filter(needsEffectiveBackfill);
    const incomingsNeedingBackfill = incomings.filter(needsEffectiveBackfill);

    for (const expense of expensesNeedingBackfill.slice(0, limit)) {
      await ctx.db.patch(expense._id, {
        effectiveAmount: expense.amount,
        effectiveAmountMode: "auto",
      });
      expensesUpdated++;
    }
    for (const incoming of incomingsNeedingBackfill.slice(0, limit)) {
      await ctx.db.patch(incoming._id, {
        effectiveAmount: incoming.amount,
        effectiveAmountMode: "auto",
      });
      incomingsUpdated++;
    }

    return {
      expensesScanned: expenses.length,
      expensesUpdated,
      incomingsScanned: incomings.length,
      incomingsUpdated,
      done:
        expensesNeedingBackfill.length <= limit &&
        incomingsNeedingBackfill.length <= limit,
    };
  },
});