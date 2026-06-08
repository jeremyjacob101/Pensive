import { deletePaybackLinksForIncoming, normalizeEffectiveAmountFields, recomputeIncomingEffectiveAmount, type EffectiveAmountMode } from "./paybackHelpers";
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

function normalizeAccountLookup(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeSharedFields(args: {
  baseIncomingId?: string;
  subIncomingId?: string;
}) {
  return {
    baseIncomingId: args.baseIncomingId?.trim() || undefined,
    subIncomingId: args.subIncomingId?.trim() || undefined,
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

async function listRowsByBaseIncomingId(
  ctx: MutationCtx,
  userId: Id<"users">,
  baseIncomingId: string,
) {
  return await ctx.db
    .query("incomings")
    .withIndex("by_user_base_incoming_id", (q) =>
      q.eq("userId", userId).eq("baseIncomingId", baseIncomingId))
    .collect();
}

async function normalizeIncomingGroup(
  ctx: MutationCtx,
  rows: Array<{
    _id: Id<"incomings">;
    _creationTime: number;
    baseIncomingId?: string;
  }>,
  baseIncomingId: string | undefined,
) {
  if (!baseIncomingId || rows.length <= 1) {
    for (const row of rows) {
      await ctx.db.patch(row._id, {
        baseIncomingId: undefined,
        subIncomingId: undefined,
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
  for (let index = 0; index < sorted.length; index += 1) {
    await ctx.db.patch(sorted[index]._id, {
      baseIncomingId,
      subIncomingId: String(index + 1).padStart(3, "0"),
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
      .query("incomings")
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
    const trimmedAccount = account.trim();
    const normalizedCursorPrefix = "normalized:";
    const shouldUseNormalizedLookup =
      paginationOpts.cursor?.startsWith(normalizedCursorPrefix) ?? false;

    if (!shouldUseNormalizedLookup) {
      const exactPage = await ctx.db
        .query("incomings")
        .withIndex("by_user_account_date", (q) =>
          q.eq("userId", userId).eq("account", trimmedAccount))
        .order("desc")
        .paginate({ ...paginationOpts, numItems });

      if (exactPage.page.length > 0 || !exactPage.isDone) {
        return exactPage;
      }
    }

    const normalizedAccount = normalizeAccountLookup(trimmedAccount);
    const offset = shouldUseNormalizedLookup
      ? Number(paginationOpts.cursor?.slice(normalizedCursorPrefix.length) ?? 0)
      : 0;
    const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const matchingRows = (
      await ctx.db
        .query("incomings")
        .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
        .order("desc")
        .collect()
    ).filter((row) => normalizeAccountLookup(row.account) === normalizedAccount);
    const page = matchingRows.slice(safeOffset, safeOffset + numItems);
    const nextOffset = safeOffset + page.length;

    return {
      page,
      isDone: nextOffset >= matchingRows.length,
      continueCursor:
        nextOffset >= matchingRows.length
          ? null
          : `${normalizedCursorPrefix}${nextOffset}`,
    };
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
      .query("incomings")
      .withIndex("by_user_id_date", (q) =>
        q.eq("userId", userId).gte("date", startDate).lte("date", endDate))
      .order("desc")
      .collect();

    const rowsById = new Map(scopedRows.map((row) => [row._id, row]));

    if (includeMonthYearOverlapOutsideDate && (targetMonths?.length ?? 0) > 0) {
      const monthSet = new Set(targetMonths ?? []);
      const candidates = await ctx.db
        .query("incomings")
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
      .query("incomings")
      .withIndex("by_user_id_date", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const oldest = await ctx.db
      .query("incomings")
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
      .query("incomings")
      .withIndex("by_user_id_date", (q) =>
        q.eq("userId", userId).lt("date", `${month}-01`))
      .order("desc")
      .first();

    return row ? toMonth(row.date, row.monthYears) : null;
  },
});

export const create = mutation({
  args: {
    incoming: v.string(),
    paidBy: v.string(),
    incomeType: v.string(),
    incomeSubtype: v.optional(v.string()),
    account: v.string(),
    amount: v.number(),
    effectiveAmount: v.optional(v.number()),
    effectiveAmountMode: v.optional(effectiveAmountModeValidator),
    date: v.string(),
    monthYears: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    incomingId: v.string(),
    baseIncomingId: v.optional(v.string()),
    subIncomingId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const incomingId = args.incomingId.trim() || randomId16();
    const shared = normalizeSharedFields(args);
    const monthYears = normalizeMonthYearsInput(args.monthYears, args.date);
    const effective = normalizeEffectiveAmountFields({ ...args, monthYears });

    return await ctx.db.insert("incomings", {
      ...args,
      ...shared,
      ...effective,
      monthYears,
      incomingId,
      userId,
      date: normalizeDate(args.date),
    });
  },
});

export const bulkCreate = mutation({
  args: {
    rows: v.array(
      v.object({
        incoming: v.string(),
        paidBy: v.string(),
        incomeType: v.string(),
        incomeSubtype: v.optional(v.string()),
        account: v.string(),
        amount: v.number(),
        effectiveAmount: v.optional(v.number()),
        effectiveAmountMode: v.optional(effectiveAmountModeValidator),
        date: v.string(),
        monthYears: v.optional(v.array(v.string())),
        notes: v.optional(v.string()),
        comments: v.optional(v.string()),
        incomingId: v.string(),
        baseIncomingId: v.optional(v.string()),
        subIncomingId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const userId = await requireUserId(ctx);
    for (const row of rows) {
      const incomingId = row.incomingId.trim() || randomId16();
      const shared = normalizeSharedFields(row);
      const monthYears = normalizeMonthYearsInput(row.monthYears, row.date);
      const effective = normalizeEffectiveAmountFields({ ...row, monthYears });

      await ctx.db.insert("incomings", {
        ...row,
        ...shared,
        ...effective,
        monthYears,
        incomingId,
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
      .query("incomings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .take(limit);
    for (const doc of docs) {
      await deletePaybackLinksForIncoming(ctx, userId, doc._id);
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length, done: docs.length < limit };
  },
});

export const update = mutation({
  args: {
    id: v.id("incomings"),
    incoming: v.string(),
    paidBy: v.string(),
    incomeType: v.string(),
    incomeSubtype: v.optional(v.string()),
    account: v.string(),
    amount: v.number(),
    effectiveAmount: v.optional(v.number()),
    effectiveAmountMode: v.optional(effectiveAmountModeValidator),
    date: v.string(),
    monthYears: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    incomingId: v.string(),
    baseIncomingId: v.optional(v.string()),
    subIncomingId: v.optional(v.string()),
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

    const incomingId = rest.incomingId.trim() || existing.incomingId;
    const shared = normalizeSharedFields(rest);
    const monthYears = normalizeMonthYearsInput(
      rest.monthYears ?? existing.monthYears ?? [],
      rest.date,
    );
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
      incomingId,
      date: normalizeDate(rest.date),
    });
    if (nextEffectiveAmountMode === "auto") {
      await recomputeIncomingEffectiveAmount(ctx, userId, id);
    }
    return id;
  },
});

export const bulkPatchVisible = mutation({
  args: {
    ids: v.array(v.id("incomings")),
    patch: v.object({
      incomeType: v.optional(v.string()),
      incomeSubtype: v.optional(v.union(v.string(), v.null())),
      account: v.optional(v.string()),
      paidBy: v.optional(v.string()),
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
      throw new Error("One or more selected incomings were not found");
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

export const addPartnerIncoming = mutation({
  args: {
    anchorIncomingId: v.id("incomings"),
    partnerIncomingId: v.id("incomings"),
  },
  handler: async (ctx, { anchorIncomingId, partnerIncomingId }) => {
    const userId = await requireUserId(ctx);
    if (anchorIncomingId === partnerIncomingId) {
      throw new Error("Cannot partner an incoming with itself");
    }

    const anchor = await ctx.db.get(anchorIncomingId);
    const partner = await ctx.db.get(partnerIncomingId);
    if (
      !anchor ||
      !partner ||
      anchor.userId !== userId ||
      partner.userId !== userId
    ) {
      throw new Error("One or more selected incomings were not found");
    }

    const anchorBaseId = anchor.baseIncomingId?.trim() || anchor.incomingId;
    const anchorRows = anchor.baseIncomingId
      ? await listRowsByBaseIncomingId(ctx, userId, anchor.baseIncomingId)
      : [anchor];

    const partnerBaseId = partner.baseIncomingId?.trim() || "";
    if (partnerBaseId && partnerBaseId === anchorBaseId) {
      return { linked: anchorRows.length, baseIncomingId: anchorBaseId };
    }

    const oldPartnerGroupRows = partnerBaseId
      ? await listRowsByBaseIncomingId(ctx, userId, partnerBaseId)
      : [];
    const oldPartnerGroupWithoutTarget = oldPartnerGroupRows.filter(
      (row) => row._id !== partner._id,
    );
    await normalizeIncomingGroup(
      ctx,
      oldPartnerGroupWithoutTarget,
      partnerBaseId || undefined,
    );

    const mergedRows = [
      ...anchorRows.filter((row) => row._id !== partner._id),
      partner,
    ];
    await normalizeIncomingGroup(ctx, mergedRows, anchorBaseId);

    return { linked: mergedRows.length, baseIncomingId: anchorBaseId };
  },
});

export const unlinkIncomingFromPartners = mutation({
  args: {
    incomingId: v.id("incomings"),
  },
  handler: async (ctx, { incomingId }) => {
    const userId = await requireUserId(ctx);
    const target = await ctx.db.get(incomingId);
    if (!target || target.userId !== userId) {
      throw new Error("Incoming not found");
    }

    const baseId = target.baseIncomingId?.trim();
    if (!baseId) {
      return { unlinked: 0, remainingLinked: 0 };
    }

    const groupRows = await listRowsByBaseIncomingId(ctx, userId, baseId);
    const remaining = groupRows.filter((row) => row._id !== target._id);

    await ctx.db.patch(target._id, {
      baseIncomingId: undefined,
      subIncomingId: undefined,
    });
    await normalizeIncomingGroup(ctx, remaining, baseId);

    return { unlinked: 1, remainingLinked: Math.max(remaining.length, 0) };
  },
});

export const remove = mutation({
  args: { id: v.id("incomings") },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }
    await deletePaybackLinksForIncoming(ctx, userId, id);
    await ctx.db.delete(id as Id<"incomings">);
    return id;
  },
});
