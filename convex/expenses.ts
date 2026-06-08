import { deletePaybackLinksForExpense, normalizeEffectiveAmountFields, recomputeExpenseEffectiveAmount, type EffectiveAmountMode } from "./paybackHelpers";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { normalizeMonthYearsInput } from "./monthYears";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

function randomId16() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function normalizeDate(value: string) {
  const input = value.trim();
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return input;

  const usMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const mm = usMatch[1].padStart(2, "0");
    const dd = usMatch[2].padStart(2, "0");
    const yyyy = usMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return input;
}

function toIsoDate(value: string) {
  const input = value.trim();
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const us = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return "";
}

function toMonth(value: string, monthYears?: string[]) {
  const iso = toIsoDate(value);
  if (iso) return iso.slice(0, 7);
  const fallback = monthYears?.find((m) => /^\d{4}-\d{2}$/.test(m));
  return fallback ?? null;
}

function normalizeSharedFields(args: {
  baseExpenseId?: string;
  baseExpenseLabel?: string;
  subExpenseId?: string;
}) {
  return {
    baseExpenseId: args.baseExpenseId?.trim() || undefined,
    baseExpenseLabel: args.baseExpenseLabel?.trim() || undefined,
    subExpenseId: args.subExpenseId?.trim() || undefined,
  };
}

const effectiveAmountModeValidator = v.union(
  v.literal("auto"),
  v.literal("manual"),
);

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

async function listRowsByBaseExpenseId(
  ctx: MutationCtx,
  userId: Id<"users">,
  baseExpenseId: string,
) {
  return await ctx.db
    .query("expenses")
    .withIndex("by_user_base_expense_id", (q) =>
      q.eq("userId", userId).eq("baseExpenseId", baseExpenseId))
    .collect();
}

async function normalizeExpenseGroup(
  ctx: MutationCtx,
  rows: Array<{
    _id: Id<"expenses">;
    _creationTime: number;
    expense: string;
    baseExpenseId?: string;
    baseExpenseLabel?: string;
  }>,
  baseExpenseId: string | undefined,
  baseExpenseLabel: string | undefined,
) {
  if (!baseExpenseId || rows.length <= 1) {
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        baseExpenseId: undefined,
        baseExpenseLabel: undefined,
        subExpenseId: undefined,
      });
    }
    return;
  }

  const sorted = rows
    .slice()
    .sort((a, b) =>
      a._creationTime === b._creationTime
        ? a._id.localeCompare(b._id)
        : a._creationTime - b._creationTime);
  const label =
    baseExpenseLabel?.trim() || sorted[0]?.expense || "Shared Expense";

  for (let index = 0; index < sorted.length; index += 1) {
    await ctx.db.patch(sorted[index]._id, {
      baseExpenseId,
      baseExpenseLabel: label,
      subExpenseId: String(index + 1).padStart(3, "0"),
    });
  }
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await requireUserId(ctx);
    const numItems = Math.min(paginationOpts.numItems, 50);
    return await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ ...paginationOpts, numItems });
  },
});

export const listByAccount = query({
  args: {
    account: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { account, paginationOpts }) => {
    const userId = await requireUserId(ctx);
    const numItems = Math.min(paginationOpts.numItems, 20);
    return await ctx.db
      .query("expenses")
      .withIndex("by_user_account_date", (q) =>
        q.eq("userId", userId).eq("account", account))
      .order("desc")
      .paginate({ ...paginationOpts, numItems });
  },
});

export const listByDateScope = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    targetMonths: v.optional(v.array(v.string())),
    includeMonthYearOverlapOutsideDate: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { startDate, endDate, targetMonths, includeMonthYearOverlapOutsideDate },
  ) => {
    const userId = await requireUserId(ctx);
    const scopedRows = await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate))
      .order("desc")
      .collect();

    const rowsById = new Map(scopedRows.map((row) => [row._id, row]));

    if (includeMonthYearOverlapOutsideDate && (targetMonths?.length ?? 0) > 0) {
      const monthSet = new Set(targetMonths ?? []);
      const candidates = await ctx.db
        .query("expenses")
        .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
        .order("desc")
        .take(500);

      for (const row of candidates) {
        if ((row.monthYears ?? []).some((month) => monthSet.has(month))) {
          rowsById.set(row._id, row);
        }
      }
    }

    const rows = [...rowsById.values()];
    rows.sort((a, b) => {
      if (a.date === b.date) return b._creationTime - a._creationTime;
      return b.date.localeCompare(a.date);
    });
    return rows;
  },
});

export const monthBounds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const newest = await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const oldest = await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .order("asc")
      .first();
    const newestMonth = newest ? toMonth(newest.date, newest.monthYears) : null;
    const oldestMonth = oldest ? toMonth(oldest.date, oldest.monthYears) : null;
    return {
      newestMonth,
      oldestMonth,
    };
  },
});

export const previousMonthBefore = query({
  args: {
    month: v.string(),
  },
  handler: async (ctx, { month }) => {
    const userId = await requireUserId(ctx);
    if (!/^\d{4}-\d{2}$/.test(month)) return null;

    const row = await ctx.db
      .query("expenses")
      .withIndex("by_user_id_date", (q) =>
        q.eq("userId", userId).lt("date", `${month}-01`))
      .order("desc")
      .first();

    return row ? toMonth(row.date, row.monthYears) : null;
  },
});

export const create = mutation({
  args: {
    expense: v.string(),
    account: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    amount: v.number(),
    effectiveAmount: v.optional(v.number()),
    effectiveAmountMode: v.optional(effectiveAmountModeValidator),
    monthYears: v.optional(v.array(v.string())),
    date: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    expenseId: v.string(),
    baseExpenseId: v.optional(v.string()),
    baseExpenseLabel: v.optional(v.string()),
    subExpenseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const expenseId = args.expenseId.trim() || randomId16();
    const shared = normalizeSharedFields(args);
    const monthYears = normalizeMonthYearsInput(args.monthYears, args.date);
    const effective = normalizeEffectiveAmountFields({ ...args, monthYears });

    return await ctx.db.insert("expenses", {
      ...args,
      ...shared,
      ...effective,
      monthYears,
      expenseId,
      userId,
      date: normalizeDate(args.date),
    });
  },
});

export const bulkCreate = mutation({
  args: {
    rows: v.array(
      v.object({
        expense: v.string(),
        account: v.string(),
        category: v.string(),
        subcategory: v.optional(v.string()),
        amount: v.number(),
        effectiveAmount: v.optional(v.number()),
        effectiveAmountMode: v.optional(effectiveAmountModeValidator),
        monthYears: v.optional(v.array(v.string())),
        date: v.string(),
        paidTo: v.string(),
        notes: v.optional(v.string()),
        comments: v.optional(v.string()),
        expenseId: v.string(),
        baseExpenseId: v.optional(v.string()),
        baseExpenseLabel: v.optional(v.string()),
        subExpenseId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const userId = await requireUserId(ctx);
    for (const row of rows) {
      const expenseId = row.expenseId.trim() || randomId16();
      const shared = normalizeSharedFields(row);
      const monthYears = normalizeMonthYearsInput(row.monthYears, row.date);
      const effective = normalizeEffectiveAmountFields({ ...row, monthYears });

      await ctx.db.insert("expenses", {
        ...row,
        ...shared,
        ...effective,
        monthYears,
        expenseId,
        userId,
        date: normalizeDate(row.date),
      });
    }
    return { inserted: rows.length };
  },
});

export const clearAll = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }) => {
    const userId = await requireUserId(ctx);
    const limit = batchSize ?? 200;
    const docs = await ctx.db
      .query("expenses")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .take(limit);
    for (const doc of docs) {
      await deletePaybackLinksForExpense(ctx, userId, doc._id);
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length, done: docs.length < limit };
  },
});

export const update = mutation({
  args: {
    id: v.id("expenses"),
    expense: v.string(),
    account: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    amount: v.number(),
    effectiveAmount: v.optional(v.number()),
    effectiveAmountMode: v.optional(effectiveAmountModeValidator),
    monthYears: v.optional(v.array(v.string())),
    date: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    expenseId: v.string(),
    baseExpenseId: v.optional(v.string()),
    baseExpenseLabel: v.optional(v.string()),
    subExpenseId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { id, effectiveAmount, effectiveAmountMode, ...rest },
  ) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }

    const expenseId = rest.expenseId.trim() || existing.expenseId;
    const shared = normalizeSharedFields(rest);
    const monthYears = normalizeMonthYearsInput(rest.monthYears, rest.date);
    const nextEffectiveAmountMode =
      effectiveAmountMode ??
      ((existing.effectiveAmountMode ?? "auto") as EffectiveAmountMode);
    const nextEffectiveAmount =
      nextEffectiveAmountMode === "manual"
        ? (effectiveAmount ?? existing.effectiveAmount ?? rest.amount)
        : rest.amount;

    await ctx.db.patch(id, {
      ...rest,
      ...shared,
      monthYears,
      effectiveAmount: nextEffectiveAmount,
      effectiveAmountMode: nextEffectiveAmountMode,
      expenseId,
      date: normalizeDate(rest.date),
    });
    if (nextEffectiveAmountMode === "auto") {
      await recomputeExpenseEffectiveAmount(ctx, userId, id);
    }
    return id;
  },
});

export const bulkPatchVisible = mutation({
  args: {
    ids: v.array(v.id("expenses")),
    patch: v.object({
      account: v.optional(v.string()),
      category: v.optional(v.string()),
      subcategory: v.optional(v.union(v.string(), v.null())),
      paidTo: v.optional(v.string()),
      notes: v.optional(v.union(v.string(), v.null())),
      comments: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, { ids, patch }) => {
    const userId = await requireUserId(ctx);
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return { updatedCount: 0 };

    const rows = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)));
    if (rows.some((row) => !row || row.userId !== userId)) {
      throw new Error("One or more selected expenses were not found");
    }

    const entries = Object.entries(patch).filter(
      ([, value]) => value !== undefined,
    );
    if (entries.length === 0) return { updatedCount: 0 };
    const normalizedPatch = Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        value === null
          ? undefined
          : typeof value === "string"
            ? value.trim()
            : value,
      ]),
    ) as Record<string, string | undefined>;

    for (const row of rows) {
      if (!row) continue;
      await ctx.db.patch(row._id, normalizedPatch);
    }

    return { updatedCount: uniqueIds.length };
  },
});

export const renameBaseExpense = mutation({
  args: {
    baseExpenseId: v.string(),
    baseExpenseLabel: v.string(),
  },
  handler: async (ctx, { baseExpenseId, baseExpenseLabel }) => {
    const userId = await requireUserId(ctx);
    const targetBaseId = baseExpenseId.trim();
    const nextLabel = baseExpenseLabel.trim();

    if (!targetBaseId) {
      throw new Error("baseExpenseId is required");
    }
    if (!nextLabel) {
      throw new Error("baseExpenseLabel is required");
    }

    const rows = await listRowsByBaseExpenseId(ctx, userId, targetBaseId);
    for (const row of rows) {
      await ctx.db.patch(row._id, { baseExpenseLabel: nextLabel });
    }

    return { updated: rows.length, baseExpenseId: targetBaseId };
  },
});

export const removeBaseExpense = mutation({
  args: {
    baseExpenseId: v.string(),
  },
  handler: async (ctx, { baseExpenseId }) => {
    const userId = await requireUserId(ctx);
    const targetBaseId = baseExpenseId.trim();
    if (!targetBaseId) {
      throw new Error("baseExpenseId is required");
    }

    const rows = await listRowsByBaseExpenseId(ctx, userId, targetBaseId);
    for (const row of rows) {
      await deletePaybackLinksForExpense(ctx, userId, row._id);
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, baseExpenseId: targetBaseId };
  },
});

export const addPartnerExpense = mutation({
  args: {
    anchorExpenseId: v.id("expenses"),
    partnerExpenseId: v.id("expenses"),
  },
  handler: async (ctx, { anchorExpenseId, partnerExpenseId }) => {
    const userId = await requireUserId(ctx);
    if (anchorExpenseId === partnerExpenseId) {
      throw new Error("Cannot partner an expense with itself");
    }

    const anchor = await ctx.db.get(anchorExpenseId);
    const partner = await ctx.db.get(partnerExpenseId);
    if (
      !anchor ||
      !partner ||
      anchor.userId !== userId ||
      partner.userId !== userId
    ) {
      throw new Error("One or more selected expenses were not found");
    }

    const anchorBaseId = anchor.baseExpenseId?.trim() || anchor.expenseId;
    const anchorLabel =
      anchor.baseExpenseLabel?.trim() || anchor.expense.trim();

    const currentAnchorRows = anchor.baseExpenseId
      ? await listRowsByBaseExpenseId(ctx, userId, anchor.baseExpenseId)
      : [anchor];

    const partnerCurrentBaseId = partner.baseExpenseId?.trim() || "";
    if (partnerCurrentBaseId && partnerCurrentBaseId === anchorBaseId) {
      return { linked: currentAnchorRows.length, baseExpenseId: anchorBaseId };
    }

    const partnerOldGroupRows = partnerCurrentBaseId
      ? await listRowsByBaseExpenseId(ctx, userId, partnerCurrentBaseId)
      : [];
    const partnerOldWithoutTarget = partnerOldGroupRows.filter(
      (row) => row._id !== partner._id,
    );

    await normalizeExpenseGroup(
      ctx,
      partnerOldWithoutTarget,
      partnerCurrentBaseId || undefined,
      partnerOldWithoutTarget[0]?.baseExpenseLabel,
    );

    const anchorRowsWithoutPartner = currentAnchorRows.filter(
      (row) => row._id !== partner._id,
    );
    const mergedRows = [...anchorRowsWithoutPartner, partner];
    await normalizeExpenseGroup(ctx, mergedRows, anchorBaseId, anchorLabel);

    return { linked: mergedRows.length, baseExpenseId: anchorBaseId };
  },
});

export const unlinkExpenseFromPartners = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, { expenseId }) => {
    const userId = await requireUserId(ctx);
    const target = await ctx.db.get(expenseId);
    if (!target || target.userId !== userId) {
      throw new Error("Expense not found");
    }

    const baseId = target.baseExpenseId?.trim();
    if (!baseId) {
      return { unlinked: 0, remainingLinked: 0 };
    }

    const groupRows = await listRowsByBaseExpenseId(ctx, userId, baseId);
    const remaining = groupRows.filter((row) => row._id !== target._id);

    await ctx.db.patch(target._id, {
      baseExpenseId: undefined,
      baseExpenseLabel: undefined,
      subExpenseId: undefined,
    });
    await normalizeExpenseGroup(
      ctx,
      remaining,
      baseId,
      remaining[0]?.baseExpenseLabel,
    );

    return { unlinked: 1, remainingLinked: Math.max(remaining.length, 0) };
  },
});

export const linkExistingExpenses = mutation({
  args: {
    expenseIds: v.array(v.id("expenses")),
    baseExpenseLabel: v.optional(v.string()),
  },
  handler: async (ctx, { expenseIds, baseExpenseLabel }) => {
    const userId = await requireUserId(ctx);
    const uniqueIds = [...new Set(expenseIds)];
    if (uniqueIds.length < 2) {
      throw new Error("Select at least two expenses to link");
    }

    const rows: Array<{
      _id: Id<"expenses">;
      _creationTime: number;
      expenseId: string;
      expense: string;
      userId?: Id<"users">;
    }> = [];
    for (const id of uniqueIds) {
      const row = await ctx.db.get(id);
      if (!row || row.userId !== userId) {
        throw new Error("One or more selected expenses were not found");
      }
      rows.push(row);
    }

    const sorted = rows
      .slice()
      .sort((a, b) =>
        a._creationTime === b._creationTime
          ? a._id.localeCompare(b._id)
          : a._creationTime - b._creationTime);
    const anchor = sorted[0];
    const sharedBaseExpenseId = anchor.expenseId;
    const sharedLabel =
      baseExpenseLabel?.trim() || anchor.expense.trim() || "Shared Expense";

    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      await ctx.db.patch(row._id, {
        baseExpenseId: sharedBaseExpenseId,
        baseExpenseLabel: sharedLabel,
        subExpenseId: String(index + 1).padStart(3, "0"),
      });
    }

    return {
      linked: sorted.length,
      baseExpenseId: sharedBaseExpenseId,
      baseExpenseLabel: sharedLabel,
    };
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }
    await deletePaybackLinksForExpense(ctx, userId, id);
    await ctx.db.delete(id as Id<"expenses">);
    return id;
  },
});