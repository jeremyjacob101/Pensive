import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const optionKind = v.union(
  v.literal("expenseType"),
  v.literal("account"),
  v.literal("category"),
  v.literal("incomeType"),
);

const MAX_OPTIONS_PER_KIND = 250;

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

async function upsertOption(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: "expenseType" | "account" | "category" | "incomeType",
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const existing = await ctx.db
    .query("userOptions")
    .withIndex("by_user_kind_value", (q) =>
      q.eq("userId", userId).eq("kind", kind).eq("value", trimmed))
    .first();
  if (!existing) {
    const current = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", kind))
      .take(MAX_OPTIONS_PER_KIND + 1);
    if (current.length >= MAX_OPTIONS_PER_KIND) {
      throw new Error(
        `Too many ${kind} options. Remove one before adding another.`,
      );
    }
    await ctx.db.insert("userOptions", { userId, kind, value: trimmed });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const expenseTypeRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) =>
        q.eq("userId", userId).eq("kind", "expenseType"))
      .take(MAX_OPTIONS_PER_KIND);
    const accountRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) =>
        q.eq("userId", userId).eq("kind", "account"))
      .take(MAX_OPTIONS_PER_KIND);
    const categoryRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) =>
        q.eq("userId", userId).eq("kind", "category"))
      .take(MAX_OPTIONS_PER_KIND);
    const incomeTypeRows = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind", (q) =>
        q.eq("userId", userId).eq("kind", "incomeType"))
      .take(MAX_OPTIONS_PER_KIND);

    return {
      expenseType: expenseTypeRows
        .map((r) => r.value)
        .sort((a, b) => a.localeCompare(b)),
      account: accountRows
        .map((r) => r.value)
        .sort((a, b) => a.localeCompare(b)),
      category: categoryRows
        .map((r) => r.value)
        .sort((a, b) => a.localeCompare(b)),
      incomeType: incomeTypeRows
        .map((r) => r.value)
        .sort((a, b) => a.localeCompare(b)),
    };
  },
});

export const add = mutation({
  args: { kind: optionKind, value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const userId = await requireUserId(ctx);
    await upsertOption(ctx, userId, kind, value);
  },
});

export const remove = mutation({
  args: { kind: optionKind, value: v.string() },
  handler: async (ctx, { kind, value }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("userOptions")
      .withIndex("by_user_kind_value", (q) =>
        q.eq("userId", userId).eq("kind", kind).eq("value", value.trim()))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});