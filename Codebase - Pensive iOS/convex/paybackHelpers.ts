import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type EffectiveAmountMode = "auto" | "manual";

export type EffectiveAmountInput = {
  amount: number;
  effectiveAmount?: number;
  effectiveAmountMode?: EffectiveAmountMode;
  monthYears?: string[];
};

export type PaybackAllocationWarning = {
  kind: "expense" | "incoming";
  amount: number;
  allocated: number;
  overAllocatedBy: number;
  message: string;
};

export function normalizeEffectiveAmountFields(input: EffectiveAmountInput): {
  effectiveAmount: number;
  effectiveAmountMode: EffectiveAmountMode;
} {
  const effectiveAmountMode = input.effectiveAmountMode ?? "auto";
  return {
    effectiveAmountMode,
    effectiveAmount:
      effectiveAmountMode === "manual"
        ? (input.effectiveAmount ?? input.amount)
        : input.amount,
  };
}

export function getEffectiveAmountFallback(row: {
  amount: number;
  effectiveAmount?: number;
}) {
  return row.effectiveAmount ?? row.amount;
}

async function sumExpenseLinks(
  ctx: MutationCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
) {
  const links = await ctx.db
    .query("paybackLinks")
    .withIndex("by_user_expense", (q) =>
      q.eq("userId", userId).eq("expenseId", expenseId))
    .collect();
  return links.reduce((total, link) => total + link.allocatedAmount, 0);
}

async function sumIncomingLinks(
  ctx: MutationCtx,
  userId: Id<"users">,
  incomingId: Id<"incomings">,
) {
  const links = await ctx.db
    .query("paybackLinks")
    .withIndex("by_user_incoming", (q) =>
      q.eq("userId", userId).eq("incomingId", incomingId))
    .collect();
  return links.reduce((total, link) => total + link.allocatedAmount, 0);
}

export async function recomputeExpenseEffectiveAmount(
  ctx: MutationCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
) {
  const expense = await ctx.db.get(expenseId);
  if (!expense || expense.userId !== userId) return undefined;
  if ((expense.effectiveAmountMode ?? "auto") === "manual") {
    return getEffectiveAmountFallback(expense);
  }

  const allocated = await sumExpenseLinks(ctx, userId, expenseId);
  const effectiveAmount = expense.amount - allocated;
  await ctx.db.patch(expenseId, {
    effectiveAmount,
    effectiveAmountMode: "auto",
  });
  return effectiveAmount;
}

export async function recomputeIncomingEffectiveAmount(
  ctx: MutationCtx,
  userId: Id<"users">,
  incomingId: Id<"incomings">,
) {
  const incoming = await ctx.db.get(incomingId);
  if (!incoming || incoming.userId !== userId) return undefined;
  if ((incoming.effectiveAmountMode ?? "auto") === "manual") {
    return getEffectiveAmountFallback(incoming);
  }

  const allocated = await sumIncomingLinks(ctx, userId, incomingId);
  const effectiveAmount = incoming.amount - allocated;
  await ctx.db.patch(incomingId, {
    effectiveAmount,
    effectiveAmountMode: "auto",
  });
  return effectiveAmount;
}

export async function recomputeLinkedEffectiveAmounts(
  ctx: MutationCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
  incomingId: Id<"incomings">,
) {
  await recomputeExpenseEffectiveAmount(ctx, userId, expenseId);
  await recomputeIncomingEffectiveAmount(ctx, userId, incomingId);
}

export async function deletePaybackLinksForExpense(
  ctx: MutationCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
) {
  const links = await ctx.db
    .query("paybackLinks")
    .withIndex("by_user_expense", (q) =>
      q.eq("userId", userId).eq("expenseId", expenseId))
    .collect();
  const incomingIds = new Set<Id<"incomings">>();

  for (const link of links) {
    incomingIds.add(link.incomingId);
    await ctx.db.delete(link._id);
  }
  for (const incomingId of incomingIds) {
    await recomputeIncomingEffectiveAmount(ctx, userId, incomingId);
  }

  return links.length;
}

export async function deletePaybackLinksForIncoming(
  ctx: MutationCtx,
  userId: Id<"users">,
  incomingId: Id<"incomings">,
) {
  const links = await ctx.db
    .query("paybackLinks")
    .withIndex("by_user_incoming", (q) =>
      q.eq("userId", userId).eq("incomingId", incomingId))
    .collect();
  const expenseIds = new Set<Id<"expenses">>();

  for (const link of links) {
    expenseIds.add(link.expenseId);
    await ctx.db.delete(link._id);
  }
  for (const expenseId of expenseIds) {
    await recomputeExpenseEffectiveAmount(ctx, userId, expenseId);
  }

  return links.length;
}

export async function getAllocationWarnings(
  ctx: MutationCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
  incomingId: Id<"incomings">,
) {
  const [expense, incoming, expenseAllocated, incomingAllocated] =
    await Promise.all([
      ctx.db.get(expenseId),
      ctx.db.get(incomingId),
      sumExpenseLinks(ctx, userId, expenseId),
      sumIncomingLinks(ctx, userId, incomingId),
    ]);

  const warnings: PaybackAllocationWarning[] = [];
  if (expense && expenseAllocated > expense.amount) {
    const overAllocatedBy = expenseAllocated - expense.amount;
    warnings.push({
      kind: "expense",
      amount: expense.amount,
      allocated: expenseAllocated,
      overAllocatedBy,
      message: `Expense is over-allocated by ${overAllocatedBy}.`,
    });
  }
  if (incoming && incomingAllocated > incoming.amount) {
    const overAllocatedBy = incomingAllocated - incoming.amount;
    warnings.push({
      kind: "incoming",
      amount: incoming.amount,
      allocated: incomingAllocated,
      overAllocatedBy,
      message: `Incoming is over-allocated by ${overAllocatedBy}.`,
    });
  }

  return warnings;
}

export function getPaybackLinkTimestamp() {
  return Date.now();
}

export type PaybackLinkDoc = Doc<"paybackLinks">;