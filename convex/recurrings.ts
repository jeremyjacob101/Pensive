import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

function randomId16() {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("recurrings").collect();
  },
});

export const create = mutation({
  args: {
    status: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
    price: v.number(),
    frequency: v.string(),
    dayOfMonth: v.number(),
    paidBy: v.string(),
    category: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recurrings", args);
  },
});

export const bulkCreate = mutation({
  args: {
    rows: v.array(
      v.object({
        status: v.string(),
        name: v.string(),
        type: v.optional(v.string()),
        price: v.number(),
        frequency: v.string(),
        dayOfMonth: v.number(),
        paidBy: v.string(),
        category: v.string(),
        paidTo: v.string(),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      await ctx.db.insert("recurrings", row);
    }
    return { inserted: rows.length };
  },
});

export const clearAll = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize }) => {
    const limit = batchSize ?? 200;
    const docs = await ctx.db.query("recurrings").take(limit);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length, done: docs.length < limit };
  },
});

export const update = mutation({
  args: {
    id: v.id("recurrings"),
    status: v.string(),
    name: v.string(),
    type: v.optional(v.string()),
    price: v.number(),
    frequency: v.string(),
    dayOfMonth: v.number(),
    paidBy: v.string(),
    category: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, rest);
    return id;
  },
});

function formatJerusalemNow() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

export const remove = mutation({
  args: { id: v.id("recurrings") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id as Id<"recurrings">);
    return id;
  },
});

export const materializeDueExpenses = mutation({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const day = Number(runDate.split("-")[2] ?? "0");
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      throw new Error("runDate must be YYYY-MM-DD");
    }

    const due = await ctx.db
      .query("recurrings")
      .withIndex("by_day_of_month", (q) => q.eq("dayOfMonth", day))
      .collect();

    let created = 0;
    let skipped = 0;
    for (const recurring of due) {
      if (recurring.status.toLowerCase() !== "active") {
        skipped++;
        continue;
      }

      const automationKey = `recurring:${recurring._id}:${runDate}`;
      const already = await ctx.db
        .query("expenses")
        .withIndex("by_automation_key", (q) => q.eq("automationKey", automationKey))
        .collect();
      if (already.length > 0) {
        skipped++;
        continue;
      }

      await ctx.db.insert("expenses", {
        expense: recurring.name,
        type: recurring.type ?? "Recurring",
        account: recurring.paidBy,
        category: recurring.category,
        amount: recurring.price,
        date: runDate,
        paidTo: recurring.paidTo,
        notes: recurring.notes,
        comments: `Triggered at ${formatJerusalemNow()}`,
        expenseId: randomId16(),
        automationKey,
      });
      created++;
    }

    return { runDate, day, matched: due.length, created, skipped };
  },
});
