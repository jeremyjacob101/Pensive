import { mutation, query, type MutationCtx } from "./_generated/server";
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

function normalizeSharedFields(args: {
  baseIncomingId?: string;
  subIncomingId?: string;
}) {
  return {
    baseIncomingId: args.baseIncomingId?.trim() || undefined,
    subIncomingId: args.subIncomingId?.trim() || undefined,
  };
}

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

export const create = mutation({
  args: {
    incoming: v.string(),
    paidBy: v.string(),
    incomeType: v.string(),
    account: v.string(),
    amount: v.number(),
    date: v.string(),
    monthYear: v.string(),
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

    return await ctx.db.insert("incomings", {
      ...args,
      ...shared,
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
        account: v.string(),
        amount: v.number(),
        date: v.string(),
        monthYear: v.string(),
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

      await ctx.db.insert("incomings", {
        ...row,
        ...shared,
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
    account: v.string(),
    amount: v.number(),
    date: v.string(),
    monthYear: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    incomingId: v.string(),
    baseIncomingId: v.optional(v.string()),
    subIncomingId: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }

    const incomingId = rest.incomingId.trim() || existing.incomingId;
    const shared = normalizeSharedFields(rest);

    await ctx.db.patch(id, {
      ...rest,
      ...shared,
      incomingId,
      date: normalizeDate(rest.date),
    });
    return id;
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
    await ctx.db.delete(id as Id<"incomings">);
    return id;
  },
});