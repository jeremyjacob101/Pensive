import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

const tableValidator = v.union(
  v.literal("expenses"),
  v.literal("incomings"),
  v.literal("recurrings"),
);

const backfillArgs = {
  table: tableValidator,
  batchSize: v.optional(v.number()),
} as const;

function safeBatchSize(value: number | undefined) {
  return Math.max(1, Math.min(Math.floor(value ?? 100), 500));
}

function missingAmountFields(row: {
  originalAmount?: number;
  originalCurrency?: "ILS";
}) {
  return row.originalAmount === undefined || row.originalCurrency === undefined;
}

export const backfillBatch = internalMutation({
  args: backfillArgs,
  handler: async (ctx, { table, batchSize }) => {
    const limit = safeBatchSize(batchSize);
    const rows = await ctx.db
      .query(table)
      .filter((q) =>
        q.or(
          q.eq(q.field("originalAmount"), undefined),
          q.eq(q.field("originalCurrency"), undefined),
        ))
      .take(limit);

    let patched = 0;
    for (const row of rows) {
      if (!missingAmountFields(row)) continue;
      if (row.amount === undefined) {
        throw new Error(`${table} row ${row._id} is missing amount`);
      }
      await ctx.db.patch(row._id, {
        originalAmount: row.originalAmount ?? row.amount,
        originalCurrency: row.originalCurrency ?? "ILS",
      });
      patched += 1;
    }

    return {
      table,
      scanned: rows.length,
      patched,
      done: rows.length < limit,
    };
  },
});

export const verify = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [expenses, incomings, recurrings] = await Promise.all([
      ctx.db.query("expenses").collect(),
      ctx.db.query("incomings").collect(),
      ctx.db.query("recurrings").collect(),
    ]);

    const missing = (
      rows: Array<{
        originalAmount?: number;
        originalCurrency?: "ILS";
      }>,
    ) => rows.filter(missingAmountFields).length;

    return {
      expenses: { total: expenses.length, missing: missing(expenses) },
      incomings: { total: incomings.length, missing: missing(incomings) },
      recurrings: { total: recurrings.length, missing: missing(recurrings) },
    };
  },
});