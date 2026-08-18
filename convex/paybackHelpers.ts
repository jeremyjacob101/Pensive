import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOriginalAmount } from "./ledgerAmounts";

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

export type ExpensePaybackLinkInput = {
  id?: Id<"paybackLinks">;
  incomingId: Id<"incomings">;
  allocatedAmount: number;
  notes?: string;
};

export type IncomingPaybackLinkInput = {
  id?: Id<"paybackLinks">;
  expenseId: Id<"expenses">;
  allocatedAmount: number;
  notes?: string;
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
  amount?: number;
  originalAmount?: number;
  effectiveAmount?: number;
}) {
  return row.effectiveAmount ?? getOriginalAmount(row);
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
  const effectiveAmount = getOriginalAmount(expense) - allocated;
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
  const effectiveAmount = getOriginalAmount(incoming) - allocated;
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

function normalizedAllocatedAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Payback amount must be greater than 0");
  }
  return value;
}

function normalizedNotes(value: string | undefined) {
  return value?.trim() || undefined;
}

export async function syncExpensePaybackLinks(
  ctx: MutationCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
  desiredLinks: ExpensePaybackLinkInput[],
) {
  const expense = await ctx.db.get(expenseId);
  if (!expense || expense.userId !== userId) {
    throw new Error("Expense not found");
  }

  const existingLinks = await ctx.db
    .query("paybackLinks")
    .withIndex("by_user_expense", (q) =>
      q.eq("userId", userId).eq("expenseId", expenseId))
    .collect();
  const existingById = new Map(existingLinks.map((link) => [link._id, link]));
  const retainedIds = new Set<Id<"paybackLinks">>();
  const seenLinkIds = new Set<Id<"paybackLinks">>();
  const seenIncomingIds = new Set<Id<"incomings">>();
  const affectedIncomingIds = new Set(
    existingLinks.map((link) => link.incomingId),
  );

  for (const desired of desiredLinks) {
    if (seenIncomingIds.has(desired.incomingId)) {
      throw new Error("An incoming can only be linked once");
    }
    seenIncomingIds.add(desired.incomingId);
    affectedIncomingIds.add(desired.incomingId);

    const incoming = await ctx.db.get(desired.incomingId);
    if (!incoming || incoming.userId !== userId) {
      throw new Error("Incoming not found");
    }

    const allocatedAmount = normalizedAllocatedAmount(desired.allocatedAmount);
    const notes = normalizedNotes(desired.notes);
    const existing = desired.id ? existingById.get(desired.id) : undefined;

    if (desired.id) {
      if (seenLinkIds.has(desired.id)) {
        throw new Error("A payback link can only appear once");
      }
      seenLinkIds.add(desired.id);
      if (!existing) {
        throw new Error("Payback link not found");
      }
    }

    if (existing?.incomingId === desired.incomingId) {
      retainedIds.add(existing._id);
      await ctx.db.patch(existing._id, {
        allocatedAmount,
        notes,
        updatedAt: getPaybackLinkTimestamp(),
      });
      continue;
    }

    if (existing) {
      retainedIds.add(existing._id);
      await ctx.db.delete(existing._id);
    }

    const now = getPaybackLinkTimestamp();
    await ctx.db.insert("paybackLinks", {
      userId,
      expenseId,
      incomingId: desired.incomingId,
      allocatedAmount,
      notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const existing of existingLinks) {
    if (!retainedIds.has(existing._id)) {
      await ctx.db.delete(existing._id);
    }
  }

  await recomputeExpenseEffectiveAmount(ctx, userId, expenseId);
  for (const incomingId of affectedIncomingIds) {
    await recomputeIncomingEffectiveAmount(ctx, userId, incomingId);
  }
}

export async function syncIncomingPaybackLinks(
  ctx: MutationCtx,
  userId: Id<"users">,
  incomingId: Id<"incomings">,
  desiredLinks: IncomingPaybackLinkInput[],
) {
  const incoming = await ctx.db.get(incomingId);
  if (!incoming || incoming.userId !== userId) {
    throw new Error("Incoming not found");
  }

  const existingLinks = await ctx.db
    .query("paybackLinks")
    .withIndex("by_user_incoming", (q) =>
      q.eq("userId", userId).eq("incomingId", incomingId))
    .collect();
  const existingById = new Map(existingLinks.map((link) => [link._id, link]));
  const retainedIds = new Set<Id<"paybackLinks">>();
  const seenLinkIds = new Set<Id<"paybackLinks">>();
  const seenExpenseIds = new Set<Id<"expenses">>();
  const affectedExpenseIds = new Set(
    existingLinks.map((link) => link.expenseId),
  );

  for (const desired of desiredLinks) {
    if (seenExpenseIds.has(desired.expenseId)) {
      throw new Error("An expense can only be linked once");
    }
    seenExpenseIds.add(desired.expenseId);
    affectedExpenseIds.add(desired.expenseId);

    const expense = await ctx.db.get(desired.expenseId);
    if (!expense || expense.userId !== userId) {
      throw new Error("Expense not found");
    }

    const allocatedAmount = normalizedAllocatedAmount(desired.allocatedAmount);
    const notes = normalizedNotes(desired.notes);
    const existing = desired.id ? existingById.get(desired.id) : undefined;

    if (desired.id) {
      if (seenLinkIds.has(desired.id)) {
        throw new Error("A payback link can only appear once");
      }
      seenLinkIds.add(desired.id);
      if (!existing) {
        throw new Error("Payback link not found");
      }
    }

    if (existing?.expenseId === desired.expenseId) {
      retainedIds.add(existing._id);
      await ctx.db.patch(existing._id, {
        allocatedAmount,
        notes,
        updatedAt: getPaybackLinkTimestamp(),
      });
      continue;
    }

    if (existing) {
      retainedIds.add(existing._id);
      await ctx.db.delete(existing._id);
    }

    const now = getPaybackLinkTimestamp();
    await ctx.db.insert("paybackLinks", {
      userId,
      expenseId: desired.expenseId,
      incomingId,
      allocatedAmount,
      notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const existing of existingLinks) {
    if (!retainedIds.has(existing._id)) {
      await ctx.db.delete(existing._id);
    }
  }

  await recomputeIncomingEffectiveAmount(ctx, userId, incomingId);
  for (const expenseId of affectedExpenseIds) {
    await recomputeExpenseEffectiveAmount(ctx, userId, expenseId);
  }
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
  if (expense && expenseAllocated > getOriginalAmount(expense)) {
    const amount = getOriginalAmount(expense);
    const overAllocatedBy = expenseAllocated - amount;
    warnings.push({
      kind: "expense",
      amount,
      allocated: expenseAllocated,
      overAllocatedBy,
      message: `Expense is over-allocated by ${overAllocatedBy}.`,
    });
  }
  if (incoming && incomingAllocated > getOriginalAmount(incoming)) {
    const amount = getOriginalAmount(incoming);
    const overAllocatedBy = incomingAllocated - amount;
    warnings.push({
      kind: "incoming",
      amount,
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