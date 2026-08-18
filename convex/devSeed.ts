import { canonicalLedgerAmountFields, getOriginalAmount } from "./ledgerAmounts";
import { internalMutation, internalQuery } from "./_generated/server";
import { generateSeedData } from "./devSeedData";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const effectiveAmountModeValidator = v.union(
  v.literal("auto"),
  v.literal("manual"),
);

const expenseRowValidator = v.object({
  expense: v.string(),
  account: v.string(),
  category: v.string(),
  subcategory: v.optional(v.string()),
  amount: v.number(),
  originalAmount: v.optional(v.number()),
  originalCurrency: v.optional(v.literal("ILS")),
  effectiveAmount: v.number(),
  effectiveAmountMode: effectiveAmountModeValidator,
  monthYears: v.array(v.string()),
  date: v.string(),
  paidTo: v.string(),
  notes: v.optional(v.string()),
  comments: v.optional(v.string()),
  expenseId: v.string(),
  baseExpenseId: v.optional(v.string()),
  baseExpenseLabel: v.optional(v.string()),
  subExpenseId: v.optional(v.string()),
});

const incomingRowValidator = v.object({
  incoming: v.string(),
  paidBy: v.string(),
  incomeType: v.string(),
  incomeSubtype: v.optional(v.string()),
  account: v.string(),
  amount: v.number(),
  originalAmount: v.optional(v.number()),
  originalCurrency: v.optional(v.literal("ILS")),
  effectiveAmount: v.number(),
  effectiveAmountMode: effectiveAmountModeValidator,
  date: v.string(),
  monthYears: v.array(v.string()),
  notes: v.optional(v.string()),
  comments: v.optional(v.string()),
  incomingId: v.string(),
  baseIncomingId: v.optional(v.string()),
  subIncomingId: v.optional(v.string()),
});

const optionValidator = v.object({
  kind: v.union(
    v.literal("account"),
    v.literal("category"),
    v.literal("subcategory"),
    v.literal("incomeType"),
    v.literal("incomeSubtype"),
  ),
  value: v.string(),
  parentValue: v.optional(v.string()),
  color: v.optional(v.string()),
  isDefault: v.optional(v.boolean()),
  isTracking: v.optional(v.boolean()),
});

const recurringValidator = v.object({
  status: v.string(),
  kind: v.union(v.literal("expense"), v.literal("incoming")),
  name: v.string(),
  amount: v.number(),
  originalAmount: v.optional(v.number()),
  originalCurrency: v.optional(v.literal("ILS")),
  frequency: v.string(),
  dayOfMonth: v.number(),
  recurringExpenseAccount: v.optional(v.string()),
  recurringExpenseCategory: v.optional(v.string()),
  recurringExpenseSubcategory: v.optional(v.string()),
  recurringExpensePaidTo: v.optional(v.string()),
  recurringIncomingPaidBy: v.optional(v.string()),
  recurringIncomingType: v.optional(v.string()),
  recurringIncomingSubtype: v.optional(v.string()),
  recurringIncomingAccount: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const noteValidator = v.object({
  id: v.string(),
  title: v.string(),
  content: v.string(),
});

const tableValidator = v.object({
  id: v.string(),
  title: v.string(),
  cells: v.array(v.array(v.string())),
});

const savingsBankValidator = v.object({
  name: v.string(),
  color: v.string(),
  currency: v.union(v.literal("ILS"), v.literal("USD")),
  interestEnabled: v.boolean(),
  annualInterestRate: v.number(),
  compounding: v.union(v.literal("monthly"), v.literal("yearly")),
  sortOrder: v.number(),
});

const savingsEntryValidator = v.object({
  bankId: v.id("savingsBanks"),
  date: v.string(),
  amount: v.number(),
  currency: v.union(v.literal("ILS"), v.literal("USD")),
  note: v.optional(v.string()),
});

const appTableValidator = v.union(
  v.literal("paybackLinks"),
  v.literal("expenses"),
  v.literal("incomings"),
  v.literal("userOptions"),
  v.literal("recurrings"),
  v.literal("notepadWorkspaces"),
  v.literal("savingsEntries"),
  v.literal("savingsBanks"),
  v.literal("savingsSettings"),
  v.literal("savingsExchangeRates"),
);

const CLEAR_ORDER = [
  "paybackLinks",
  "expenses",
  "incomings",
  "userOptions",
  "recurrings",
  "notepadWorkspaces",
  "savingsEntries",
  "savingsBanks",
  "savingsSettings",
  "savingsExchangeRates",
] as const;

type AppTableName = (typeof CLEAR_ORDER)[number];

const generatedSeedArgs = {
  userId: v.id("users"),
  profile: v.union(v.literal("realistic"), v.literal("stress")),
  seed: v.number(),
  asOfDate: v.string(),
} as const;

function generatedData(args: {
  profile: "realistic" | "stress";
  seed: number;
  asOfDate: string;
}) {
  return generateSeedData(args);
}

function canonicalizeLedgerRow<
  T extends {
    amount?: number;
    originalAmount?: number;
    originalCurrency?: "ILS";
  },
>(row: T) {
  const {
    amount: _legacyAmount,
    originalAmount: _originalAmount,
    originalCurrency: _originalCurrency,
    ...rest
  } = row;
  return {
    ...rest,
    ...canonicalLedgerAmountFields(row),
  };
}

export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      _id: user._id,
      name: user.name ?? null,
      username: user.username ?? null,
    }));
  },
});

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? { _id: user._id, username: user.username ?? null } : null;
  },
});

export const clearTableBatch = internalMutation({
  args: {
    table: appTableValidator,
    batchSize: v.number(),
  },
  handler: async (ctx, { table, batchSize }) => {
    const limit = Math.max(1, Math.min(Math.floor(batchSize), 500));
    let deleted = 0;
    let done = true;

    switch (table as AppTableName) {
      case "paybackLinks": {
        const rows = await ctx.db.query("paybackLinks").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "expenses": {
        const rows = await ctx.db.query("expenses").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "incomings": {
        const rows = await ctx.db.query("incomings").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "userOptions": {
        const rows = await ctx.db.query("userOptions").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "recurrings": {
        const rows = await ctx.db.query("recurrings").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "notepadWorkspaces": {
        const rows = await ctx.db.query("notepadWorkspaces").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "savingsEntries": {
        const rows = await ctx.db.query("savingsEntries").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "savingsBanks": {
        const rows = await ctx.db.query("savingsBanks").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "savingsSettings": {
        const rows = await ctx.db.query("savingsSettings").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
      case "savingsExchangeRates": {
        const rows = await ctx.db.query("savingsExchangeRates").take(limit);
        for (const row of rows) await ctx.db.delete(row._id);
        deleted = rows.length;
        done = rows.length < limit;
        break;
      }
    }

    return { table, deleted, done };
  },
});

export const insertOptions = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(optionValidator),
  },
  handler: async (ctx, { userId, rows }) => {
    for (const row of rows)
      await ctx.db.insert("userOptions", { ...row, userId });
    return { inserted: rows.length };
  },
});

export const seedOptions = internalMutation({
  args: generatedSeedArgs,
  handler: async (ctx, args) => {
    const data = generatedData(args);
    for (const row of data.options) {
      await ctx.db.insert("userOptions", { ...row, userId: args.userId });
    }
    return { inserted: data.options.length };
  },
});

export const insertExpenses = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(expenseRowValidator),
  },
  handler: async (ctx, { userId, rows }) => {
    const ids: Id<"expenses">[] = [];
    for (const row of rows)
      ids.push(
        await ctx.db.insert("expenses", {
          ...canonicalizeLedgerRow(row),
          userId,
        }),
      );
    return ids;
  },
});

export const seedExpenseBatch = internalMutation({
  args: {
    ...generatedSeedArgs,
    batchIndex: v.number(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const data = generatedData(args);
    const batchSize = Math.max(1, Math.min(Math.floor(args.batchSize), 200));
    const start = Math.max(0, Math.floor(args.batchIndex)) * batchSize;
    const batch = data.expenses.slice(start, start + batchSize);
    const rows: Array<{ key: string; id: Id<"expenses"> }> = [];
    for (const row of batch) {
      const { key: _key, ...expense } = row;
      const id = await ctx.db.insert("expenses", {
        ...canonicalizeLedgerRow(expense),
        userId: args.userId,
      });
      rows.push({ key: row.key, id });
    }
    return {
      rows,
      inserted: batch.length,
      total: data.expenses.length,
      done: start + batch.length >= data.expenses.length,
    };
  },
});

export const insertIncomings = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(incomingRowValidator),
  },
  handler: async (ctx, { userId, rows }) => {
    const ids: Id<"incomings">[] = [];
    for (const row of rows)
      ids.push(
        await ctx.db.insert("incomings", {
          ...canonicalizeLedgerRow(row),
          userId,
        }),
      );
    return ids;
  },
});

export const seedIncomingBatch = internalMutation({
  args: {
    ...generatedSeedArgs,
    batchIndex: v.number(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const data = generatedData(args);
    const batchSize = Math.max(1, Math.min(Math.floor(args.batchSize), 200));
    const start = Math.max(0, Math.floor(args.batchIndex)) * batchSize;
    const batch = data.incomings.slice(start, start + batchSize);
    const rows: Array<{ key: string; id: Id<"incomings"> }> = [];
    for (const row of batch) {
      const { key: _key, ...incoming } = row;
      const id = await ctx.db.insert("incomings", {
        ...canonicalizeLedgerRow(incoming),
        userId: args.userId,
      });
      rows.push({ key: row.key, id });
    }
    return {
      rows,
      inserted: batch.length,
      total: data.incomings.length,
      done: start + batch.length >= data.incomings.length,
    };
  },
});

export const insertPaybackLinks = internalMutation({
  args: {
    userId: v.id("users"),
    createdAt: v.number(),
    rows: v.array(
      v.object({
        expenseId: v.id("expenses"),
        incomingId: v.id("incomings"),
        allocatedAmount: v.number(),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { userId, createdAt, rows }) => {
    for (const row of rows) {
      await ctx.db.insert("paybackLinks", {
        userId,
        expenseId: row.expenseId,
        incomingId: row.incomingId,
        allocatedAmount: row.allocatedAmount,
        notes: row.notes,
        createdAt,
        updatedAt: createdAt,
      });
    }
    return { inserted: rows.length };
  },
});

export const insertRecurrings = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(recurringValidator),
  },
  handler: async (ctx, { userId, rows }) => {
    for (const row of rows)
      await ctx.db.insert("recurrings", {
        ...canonicalizeLedgerRow(row),
        userId,
      });
    return { inserted: rows.length };
  },
});

export const insertNotepad = internalMutation({
  args: {
    userId: v.id("users"),
    notes: v.array(noteValidator),
    tables: v.array(tableValidator),
    updatedAt: v.number(),
  },
  handler: async (ctx, { userId, notes, tables, updatedAt }) => {
    await ctx.db.insert("notepadWorkspaces", {
      userId,
      notes,
      tables,
      updatedAt,
    });
    return { inserted: 1 };
  },
});

export const insertSavingsBanks = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(savingsBankValidator),
    createdAt: v.number(),
  },
  handler: async (ctx, { userId, rows, createdAt }) => {
    const ids: Id<"savingsBanks">[] = [];
    for (const [index, row] of rows.entries()) {
      ids.push(
        await ctx.db.insert("savingsBanks", {
          ...row,
          userId,
          createdAt: createdAt + index,
          updatedAt: createdAt + index,
        }),
      );
    }
    return ids;
  },
});

export const insertSavingsEntries = internalMutation({
  args: {
    userId: v.id("users"),
    rows: v.array(savingsEntryValidator),
    createdAt: v.number(),
  },
  handler: async (ctx, { userId, rows, createdAt }) => {
    for (const [index, row] of rows.entries()) {
      await ctx.db.insert("savingsEntries", {
        ...row,
        userId,
        createdAt: createdAt + index,
        updatedAt: createdAt + index,
      });
    }
    return { inserted: rows.length };
  },
});

export const insertSavingsSettings = internalMutation({
  args: {
    userId: v.id("users"),
    displayCurrency: v.union(v.literal("ILS"), v.literal("USD")),
    manualUsdIlsRate: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("savingsSettings", args);
    return { inserted: 1 };
  },
});

export const insertExchangeRate = internalMutation({
  args: {
    pair: v.string(),
    base: v.string(),
    quote: v.string(),
    rate: v.number(),
    rateDate: v.string(),
    source: v.string(),
    fetchedAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("savingsExchangeRates", args);
    return { inserted: 1 };
  },
});

export const seedSupportingData = internalMutation({
  args: generatedSeedArgs,
  handler: async (ctx, args) => {
    const data = generatedData(args);
    const timestamp = Date.parse(`${data.asOfDate}T12:00:00.000Z`);
    if (!Number.isFinite(timestamp)) throw new Error("Invalid seed timestamp");

    for (const row of data.recurrings) {
      await ctx.db.insert("recurrings", {
        ...canonicalizeLedgerRow(row),
        userId: args.userId,
      });
    }
    await ctx.db.insert("notepadWorkspaces", {
      userId: args.userId,
      notes: data.notes,
      tables: data.tables,
      updatedAt: timestamp,
    });

    const bankIds = new Map<string, Id<"savingsBanks">>();
    for (const bank of data.savingsBanks) {
      const bankId = await ctx.db.insert("savingsBanks", {
        name: bank.name,
        color: bank.color,
        currency: bank.currency,
        interestEnabled: bank.interestEnabled,
        annualInterestRate: bank.annualInterestRate,
        compounding: bank.compounding,
        sortOrder: bank.sortOrder,
        userId: args.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      bankIds.set(bank.key, bankId);
    }
    for (const [index, entry] of data.savingsEntries.entries()) {
      const bankId = bankIds.get(entry.bankKey);
      if (!bankId)
        throw new Error("Generated savings entry references a missing bank");
      await ctx.db.insert("savingsEntries", {
        userId: args.userId,
        bankId,
        date: entry.date,
        amount: entry.amount,
        currency: entry.currency,
        note: entry.note,
        createdAt: timestamp + index,
        updatedAt: timestamp + index,
      });
    }
    await ctx.db.insert("savingsSettings", {
      userId: args.userId,
      ...data.savingsSettings,
      updatedAt: timestamp,
    });
    await ctx.db.insert("savingsExchangeRates", {
      ...data.exchangeRate,
      fetchedAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      recurrings: data.recurrings.length,
      notes: data.notes.length,
      tables: data.tables.length,
      savingsBanks: data.savingsBanks.length,
      savingsEntries: data.savingsEntries.length,
    };
  },
});

export const getPaybackBatch = internalQuery({
  args: {
    ...generatedSeedArgs,
    batchIndex: v.number(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    void ctx;
    const data = generatedData(args);
    const batchSize = Math.max(1, Math.min(Math.floor(args.batchSize), 200));
    const start = Math.max(0, Math.floor(args.batchIndex)) * batchSize;
    const links = data.paybackLinks.slice(start, start + batchSize);
    return {
      links,
      total: data.paybackLinks.length,
      done: start + links.length >= data.paybackLinks.length,
    };
  },
});

export const verify = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const [
      expenses,
      incomings,
      links,
      options,
      recurrings,
      workspaces,
      banks,
      entries,
    ] = await Promise.all([
      ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("paybackLinks")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("notepadWorkspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("savingsBanks")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("savingsEntries")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect(),
    ]);
    const expenseIds = new Set(expenses.map((row) => row._id));
    const incomingIds = new Set(incomings.map((row) => row._id));
    const dates = [
      ...expenses.map((row) => row.date),
      ...incomings.map((row) => row.date),
    ].sort();
    return {
      userId,
      counts: {
        expenses: expenses.length,
        incomings: incomings.length,
        paybackLinks: links.length,
        options: options.length,
        recurrings: recurrings.length,
        notepadWorkspaces: workspaces.length,
        savingsBanks: banks.length,
        savingsEntries: entries.length,
      },
      dateRange: [dates[0] ?? null, dates.at(-1) ?? null],
      groupedExpenseRows: expenses.filter((row) => row.baseExpenseId).length,
      groupedIncomingRows: incomings.filter((row) => row.baseIncomingId).length,
      multiMonthExpenseRows: expenses.filter((row) => row.monthYears.length > 1)
        .length,
      largeExpenseRows: expenses.filter(
        (row) => getOriginalAmount(row) >= 4_000,
      ).length,
      paidBackIncomingRows: incomings.filter(
        (row) => row.incomeType === "Paid Back",
      ).length,
      manuallyExcludedRows: [
        ...expenses.filter(
          (row) =>
            row.effectiveAmountMode === "manual" && row.effectiveAmount === 0,
        ),
        ...incomings.filter(
          (row) =>
            row.effectiveAmountMode === "manual" && row.effectiveAmount === 0,
        ),
      ].length,
      invalidPaybackLinks: links.filter(
        (link) =>
          !expenseIds.has(link.expenseId) || !incomingIds.has(link.incomingId),
      ).length,
    };
  },
});