import { getAllocationWarnings, getPaybackLinkTimestamp, recomputeLinkedEffectiveAmounts } from "./paybackHelpers";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

function normalizeAllocatedAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("allocatedAmount must be greater than 0");
  }
  return value;
}

function normalizeNotes(value: string | undefined) {
  return value?.trim() || undefined;
}

async function requireOwnedPair(
  ctx: QueryCtx,
  userId: Id<"users">,
  expenseId: Id<"expenses">,
  incomingId: Id<"incomings">,
) {
  const [expense, incoming] = await Promise.all([
    ctx.db.get(expenseId),
    ctx.db.get(incomingId),
  ]);
  if (!expense || expense.userId !== userId) {
    throw new Error("Expense not found");
  }
  if (!incoming || incoming.userId !== userId) {
    throw new Error("Incoming not found");
  }
  return { expense, incoming };
}

export const listForExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    const userId = await requireUserId(ctx);
    const expense = await ctx.db.get(expenseId);
    if (!expense || expense.userId !== userId) {
      throw new Error("Expense not found");
    }

    const links = await ctx.db
      .query("paybackLinks")
      .withIndex("by_user_expense", (q) =>
        q.eq("userId", userId).eq("expenseId", expenseId))
      .collect();
    const rows = [];
    for (const link of links) {
      const incoming = await ctx.db.get(link.incomingId);
      if (!incoming || incoming.userId !== userId) continue;
      rows.push({ ...link, incoming });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listForIncoming = query({
  args: { incomingId: v.id("incomings") },
  handler: async (ctx, { incomingId }) => {
    const userId = await requireUserId(ctx);
    const incoming = await ctx.db.get(incomingId);
    if (!incoming || incoming.userId !== userId) {
      throw new Error("Incoming not found");
    }

    const links = await ctx.db
      .query("paybackLinks")
      .withIndex("by_user_incoming", (q) =>
        q.eq("userId", userId).eq("incomingId", incomingId))
      .collect();
    const rows = [];
    for (const link of links) {
      const expense = await ctx.db.get(link.expenseId);
      if (!expense || expense.userId !== userId) continue;
      rows.push({ ...link, expense });
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listIncomingCandidates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("incomings")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
  },
});

export const listExpenseCandidates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
  },
});

export const create = mutation({
  args: {
    expenseId: v.id("expenses"),
    incomingId: v.id("incomings"),
    allocatedAmount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { expenseId, incomingId, allocatedAmount, notes }) => {
    const userId = await requireUserId(ctx);
    await requireOwnedPair(ctx, userId, expenseId, incomingId);

    const now = getPaybackLinkTimestamp();
    const id = await ctx.db.insert("paybackLinks", {
      userId,
      expenseId,
      incomingId,
      allocatedAmount: normalizeAllocatedAmount(allocatedAmount),
      notes: normalizeNotes(notes),
      createdAt: now,
      updatedAt: now,
    });

    await recomputeLinkedEffectiveAmounts(ctx, userId, expenseId, incomingId);
    const warnings = await getAllocationWarnings(
      ctx,
      userId,
      expenseId,
      incomingId,
    );
    return { id, warnings };
  },
});

export const update = mutation({
  args: {
    id: v.id("paybackLinks"),
    allocatedAmount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, allocatedAmount, notes }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Payback link not found");
    }
    await requireOwnedPair(
      ctx,
      userId,
      existing.expenseId,
      existing.incomingId,
    );

    await ctx.db.patch(id, {
      allocatedAmount: normalizeAllocatedAmount(allocatedAmount),
      notes: normalizeNotes(notes),
      updatedAt: getPaybackLinkTimestamp(),
    });

    await recomputeLinkedEffectiveAmounts(
      ctx,
      userId,
      existing.expenseId,
      existing.incomingId,
    );
    const warnings = await getAllocationWarnings(
      ctx,
      userId,
      existing.expenseId,
      existing.incomingId,
    );
    return { id, warnings };
  },
});

export const remove = mutation({
  args: { id: v.id("paybackLinks") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Payback link not found");
    }

    await ctx.db.delete(id);
    await recomputeLinkedEffectiveAmounts(
      ctx,
      userId,
      existing.expenseId,
      existing.incomingId,
    );
    return id;
  },
});