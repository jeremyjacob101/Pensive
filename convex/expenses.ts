import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

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

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    const numItems = Math.min(paginationOpts.numItems, 50);
    return await ctx.db
      .query("expenses")
      .order("desc")
      .paginate({ ...paginationOpts, numItems });
  },
});

export const create = mutation({
  args: {
    expense: v.string(),
    type: v.string(),
    account: v.string(),
    category: v.string(),
    amount: v.number(),
    date: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    expenseId: v.string(),
    automationKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("expenses", {
      ...args,
      date: normalizeDate(args.date),
    });
  },
});

export const bulkCreate = mutation({
  args: {
    rows: v.array(
      v.object({
        expense: v.string(),
        type: v.string(),
        account: v.string(),
        category: v.string(),
        amount: v.number(),
        date: v.string(),
        paidTo: v.string(),
        notes: v.optional(v.string()),
        comments: v.optional(v.string()),
        expenseId: v.string(),
        automationKey: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      await ctx.db.insert("expenses", {
        ...row,
        date: normalizeDate(row.date),
      });
    }
    return { inserted: rows.length };
  },
});

export const clearAll = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }) => {
    const limit = batchSize ?? 200;
    const docs = await ctx.db.query("expenses").take(limit);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length, done: docs.length < limit };
  },
});

export const update = mutation({
  args: {
    id: v.id("expenses"),
    expense: v.string(),
    type: v.string(),
    account: v.string(),
    category: v.string(),
    amount: v.number(),
    date: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    expenseId: v.string(),
    automationKey: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, {
      ...rest,
      date: normalizeDate(rest.date),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id as Id<"expenses">);
    return id;
  },
});
