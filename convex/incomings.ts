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
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("incomings").collect();
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("incomings", {
      ...args,
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
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      await ctx.db.insert("incomings", {
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
    const docs = await ctx.db.query("incomings").take(limit);
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
  args: { id: v.id("incomings") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id as Id<"incomings">);
    return id;
  },
});

export const normalizeDates = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }) => {
    const limit = batchSize ?? 200;
    const docs = await ctx.db.query("incomings").take(limit);
    let updated = 0;
    for (const doc of docs) {
      const next = normalizeDate(doc.date);
      if (next !== doc.date) {
        await ctx.db.patch(doc._id, { date: next });
        updated++;
      }
    }
    return { scanned: docs.length, updated, done: docs.length < limit };
  },
});
