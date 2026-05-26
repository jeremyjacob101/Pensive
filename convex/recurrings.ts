import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { normalizeMonthYearsInput } from "./monthYears";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await requireUserId(ctx);
    const numItems = Math.min(paginationOpts.numItems, 50);
    return await ctx.db
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ ...paginationOpts, numItems });
  },
});

export const create = mutation({
  args: {
    status: v.string(),
    kind: v.union(v.literal("expense"), v.literal("incoming")),
    name: v.string(),
    type: v.optional(v.string()),
    price: v.number(),
    frequency: v.string(),
    dayOfMonth: v.number(),
    paidBy: v.optional(v.string()),
    category: v.optional(v.string()),
    paidTo: v.optional(v.string()),
    expenseType: v.optional(v.string()),
    expenseAccount: v.optional(v.string()),
    expenseCategory: v.optional(v.string()),
    expenseSubcategory: v.optional(v.string()),
    expensePaidTo: v.optional(v.string()),
    incomingPaidBy: v.optional(v.string()),
    incomingType: v.optional(v.string()),
    incomingSubtype: v.optional(v.string()),
    incomingAccount: v.optional(v.string()),
    recurringExpenseType: v.optional(v.string()),
    recurringExpenseAccount: v.optional(v.string()),
    recurringExpenseCategory: v.optional(v.string()),
    recurringExpenseSubcategory: v.optional(v.string()),
    recurringExpensePaidTo: v.optional(v.string()),
    recurringIncomingPaidBy: v.optional(v.string()),
    recurringIncomingType: v.optional(v.string()),
    recurringIncomingSubtype: v.optional(v.string()),
    recurringIncomingAccount: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const recurringExpenseType = args.recurringExpenseType ?? args.expenseType;
    const recurringExpenseAccount =
      args.recurringExpenseAccount ?? args.expenseAccount;
    const recurringExpenseCategory =
      args.recurringExpenseCategory ?? args.expenseCategory;
    const recurringExpenseSubcategory =
      args.recurringExpenseSubcategory ?? args.expenseSubcategory;
    const recurringExpensePaidTo =
      args.recurringExpensePaidTo ?? args.expensePaidTo;
    const recurringIncomingPaidBy =
      args.recurringIncomingPaidBy ?? args.incomingPaidBy;
    const recurringIncomingType =
      args.recurringIncomingType ?? args.incomingType;
    const recurringIncomingSubtype =
      args.recurringIncomingSubtype ?? args.incomingSubtype;
    const recurringIncomingAccount =
      args.recurringIncomingAccount ?? args.incomingAccount;

    if (args.kind === "expense") {
      if (
        !recurringExpenseType ||
        !recurringExpenseAccount ||
        !recurringExpenseCategory ||
        !recurringExpensePaidTo
      ) {
        throw new Error("Missing required expense recurring fields");
      }
    } else {
      if (
        !recurringIncomingPaidBy ||
        !recurringIncomingType ||
        !recurringIncomingAccount
      ) {
        throw new Error("Missing required incoming recurring fields");
      }
    }
    return await ctx.db.insert("recurrings", {
      ...args,
      recurringExpenseType,
      recurringExpenseAccount,
      recurringExpenseCategory,
      recurringExpenseSubcategory,
      recurringExpensePaidTo,
      recurringIncomingPaidBy,
      recurringIncomingType,
      recurringIncomingSubtype,
      recurringIncomingAccount,
      userId,
    });
  },
});

export const bulkCreate = mutation({
  args: {
    rows: v.array(
      v.object({
        status: v.string(),
        kind: v.union(v.literal("expense"), v.literal("incoming")),
        name: v.string(),
        type: v.optional(v.string()),
        price: v.number(),
        frequency: v.string(),
        dayOfMonth: v.number(),
        paidBy: v.optional(v.string()),
        category: v.optional(v.string()),
        paidTo: v.optional(v.string()),
        expenseType: v.optional(v.string()),
        expenseAccount: v.optional(v.string()),
        expenseCategory: v.optional(v.string()),
        expenseSubcategory: v.optional(v.string()),
        expensePaidTo: v.optional(v.string()),
        incomingPaidBy: v.optional(v.string()),
        incomingType: v.optional(v.string()),
        incomingSubtype: v.optional(v.string()),
        incomingAccount: v.optional(v.string()),
        recurringExpenseType: v.optional(v.string()),
        recurringExpenseAccount: v.optional(v.string()),
        recurringExpenseCategory: v.optional(v.string()),
        recurringExpenseSubcategory: v.optional(v.string()),
        recurringExpensePaidTo: v.optional(v.string()),
        recurringIncomingPaidBy: v.optional(v.string()),
        recurringIncomingType: v.optional(v.string()),
        recurringIncomingSubtype: v.optional(v.string()),
        recurringIncomingAccount: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const userId = await requireUserId(ctx);
    for (const row of rows) {
      await ctx.db.insert("recurrings", { ...row, userId });
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
      .query("recurrings")
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
    id: v.id("recurrings"),
    status: v.string(),
    kind: v.union(v.literal("expense"), v.literal("incoming")),
    name: v.string(),
    type: v.optional(v.string()),
    price: v.number(),
    frequency: v.string(),
    dayOfMonth: v.number(),
    paidBy: v.optional(v.string()),
    category: v.optional(v.string()),
    paidTo: v.optional(v.string()),
    expenseType: v.optional(v.string()),
    expenseAccount: v.optional(v.string()),
    expenseCategory: v.optional(v.string()),
    expenseSubcategory: v.optional(v.string()),
    expensePaidTo: v.optional(v.string()),
    incomingPaidBy: v.optional(v.string()),
    incomingType: v.optional(v.string()),
    incomingSubtype: v.optional(v.string()),
    incomingAccount: v.optional(v.string()),
    recurringExpenseType: v.optional(v.string()),
    recurringExpenseAccount: v.optional(v.string()),
    recurringExpenseCategory: v.optional(v.string()),
    recurringExpenseSubcategory: v.optional(v.string()),
    recurringExpensePaidTo: v.optional(v.string()),
    recurringIncomingPaidBy: v.optional(v.string()),
    recurringIncomingType: v.optional(v.string()),
    recurringIncomingSubtype: v.optional(v.string()),
    recurringIncomingAccount: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, kind, ...rest }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }

    const recurringExpenseType = rest.recurringExpenseType ?? rest.expenseType;
    const recurringExpenseAccount =
      rest.recurringExpenseAccount ?? rest.expenseAccount;
    const recurringExpenseCategory =
      rest.recurringExpenseCategory ?? rest.expenseCategory;
    const recurringExpensePaidTo =
      rest.recurringExpensePaidTo ?? rest.expensePaidTo;
    const recurringIncomingPaidBy =
      rest.recurringIncomingPaidBy ?? rest.incomingPaidBy;
    const recurringIncomingType =
      rest.recurringIncomingType ?? rest.incomingType;
    const recurringIncomingAccount =
      rest.recurringIncomingAccount ?? rest.incomingAccount;

    if (kind === "expense") {
      if (
        !recurringExpenseType ||
        !recurringExpenseAccount ||
        !recurringExpenseCategory ||
        !recurringExpensePaidTo
      ) {
        throw new Error("Missing required expense recurring fields");
      }
    } else {
      if (
        !recurringIncomingPaidBy ||
        !recurringIncomingType ||
        !recurringIncomingAccount
      ) {
        throw new Error("Missing required incoming recurring fields");
      }
    }

    await ctx.db.patch(id, {
      kind,
      ...rest,
      recurringExpenseType,
      recurringExpenseAccount,
      recurringExpenseCategory,
      recurringExpenseSubcategory:
        rest.recurringExpenseSubcategory ?? rest.expenseSubcategory,
      recurringExpensePaidTo,
      recurringIncomingPaidBy,
      recurringIncomingType,
      recurringIncomingSubtype:
        rest.recurringIncomingSubtype ?? rest.incomingSubtype,
      recurringIncomingAccount,
      ...(kind === "expense"
        ? {
            recurringIncomingPaidBy: undefined,
            recurringIncomingType: undefined,
            recurringIncomingSubtype: undefined,
            recurringIncomingAccount: undefined,
          }
        : {
            recurringExpenseType: undefined,
            recurringExpenseAccount: undefined,
            recurringExpenseCategory: undefined,
            recurringExpenseSubcategory: undefined,
            recurringExpensePaidTo: undefined,
          }),
    });
    return id;
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("recurrings"),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, { id, status }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }

    await ctx.db.patch(id, { status });
    return id;
  },
});

export const cleanupRecurringKindFields = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    let updated = 0;
    for (const row of rows) {
      const kind = row.kind ?? "expense";
      await ctx.db.patch(row._id, {
        recurringExpenseType: row.recurringExpenseType ?? row.expenseType,
        recurringExpenseAccount:
          row.recurringExpenseAccount ?? row.expenseAccount ?? row.paidBy,
        recurringExpenseCategory:
          row.recurringExpenseCategory ?? row.expenseCategory ?? row.category,
        recurringExpenseSubcategory:
          row.recurringExpenseSubcategory ?? row.expenseSubcategory,
        recurringExpensePaidTo:
          row.recurringExpensePaidTo ?? row.expensePaidTo ?? row.paidTo,
        recurringIncomingPaidBy:
          row.recurringIncomingPaidBy ?? row.incomingPaidBy,
        recurringIncomingType: row.recurringIncomingType ?? row.incomingType,
        recurringIncomingSubtype:
          row.recurringIncomingSubtype ?? row.incomingSubtype,
        recurringIncomingAccount:
          row.recurringIncomingAccount ?? row.incomingAccount ?? row.paidTo,
        ...(kind === "expense"
          ? {
              recurringIncomingPaidBy: undefined,
              recurringIncomingType: undefined,
              recurringIncomingSubtype: undefined,
              recurringIncomingAccount: undefined,
            }
          : {
              recurringExpenseType: undefined,
              recurringExpenseAccount: undefined,
              recurringExpenseCategory: undefined,
              recurringExpenseSubcategory: undefined,
              recurringExpensePaidTo: undefined,
            }),
      });
      updated++;
    }
    return { updated };
  },
});

export const cleanupRecurringKindFieldsForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    let updated = 0;
    for (const row of rows) {
      const kind = row.kind ?? "expense";
      await ctx.db.patch(row._id, {
        recurringExpenseType: row.recurringExpenseType ?? row.expenseType,
        recurringExpenseAccount:
          row.recurringExpenseAccount ?? row.expenseAccount ?? row.paidBy,
        recurringExpenseCategory:
          row.recurringExpenseCategory ?? row.expenseCategory ?? row.category,
        recurringExpenseSubcategory:
          row.recurringExpenseSubcategory ?? row.expenseSubcategory,
        recurringExpensePaidTo:
          row.recurringExpensePaidTo ?? row.expensePaidTo ?? row.paidTo,
        recurringIncomingPaidBy:
          row.recurringIncomingPaidBy ?? row.incomingPaidBy,
        recurringIncomingType: row.recurringIncomingType ?? row.incomingType,
        recurringIncomingSubtype:
          row.recurringIncomingSubtype ?? row.incomingSubtype,
        recurringIncomingAccount:
          row.recurringIncomingAccount ?? row.incomingAccount ?? row.paidTo,
        ...(kind === "expense"
          ? {
              recurringIncomingPaidBy: undefined,
              recurringIncomingType: undefined,
              recurringIncomingSubtype: undefined,
              recurringIncomingAccount: undefined,
            }
          : {
              recurringExpenseType: undefined,
              recurringExpenseAccount: undefined,
              recurringExpenseCategory: undefined,
              recurringExpenseSubcategory: undefined,
              recurringExpensePaidTo: undefined,
            }),
      });
      updated++;
    }
    return { updated };
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
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found");
    }

    await ctx.db.delete(id as Id<"recurrings">);
    return id;
  },
});

export const materializeDueExpenses = mutation({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const userId = await requireUserId(ctx);
    const day = Number(runDate.split("-")[2] ?? "0");
    if (!Number.isFinite(day) || day < 1 || day > 31) {
      throw new Error("runDate must be YYYY-MM-DD");
    }

    const due = await ctx.db
      .query("recurrings")
      .withIndex("by_user_id_day_of_month", (q) =>
        q.eq("userId", userId).eq("dayOfMonth", day))
      .collect();

    let created = 0;
    let skipped = 0;
    for (const recurring of due) {
      if (recurring.status.toLowerCase() !== "active") {
        skipped++;
        continue;
      }

      const kind = recurring.kind ?? "expense";
      const automationKey = `recurring:${kind}:${recurring._id}:${runDate}`;

      if (kind === "incoming") {
        const monthYears = normalizeMonthYearsInput([], runDate);
        const alreadyIncoming = await ctx.db
          .query("incomings")
          .withIndex("by_incoming_id", (q) => q.eq("incomingId", automationKey))
          .first();
        if (alreadyIncoming) {
          skipped++;
          continue;
        }
        await ctx.db.insert("incomings", {
          userId,
          incoming: recurring.name,
          paidBy: recurring.incomingPaidBy ?? "",
          incomeType:
            recurring.recurringIncomingType ?? recurring.incomingType ?? "",
          incomeSubtype:
            recurring.recurringIncomingSubtype ??
            recurring.incomingSubtype ??
            "",
          account:
            recurring.recurringIncomingAccount ??
            recurring.incomingAccount ??
            "",
          amount: recurring.price,
          effectiveAmount: recurring.price,
          effectiveAmountMode: "auto",
          date: runDate,
          monthYears,
          notes: recurring.notes,
          comments: `Triggered at ${formatJerusalemNow()}`,
          incomingId: automationKey,
        });
        created++;
        continue;
      }

      const alreadyExpense = await ctx.db
        .query("expenses")
        .withIndex("by_expense_id", (q) => q.eq("expenseId", automationKey))
        .first();
      if (alreadyExpense) {
        skipped++;
        continue;
      }

      await ctx.db.insert("expenses", {
        monthYears: normalizeMonthYearsInput([], runDate),
        userId,
        expense: recurring.name,
        type:
          recurring.recurringExpenseType ??
          recurring.expenseType ??
          recurring.type ??
          "Recurring",
        account:
          recurring.recurringExpenseAccount ??
          recurring.expenseAccount ??
          recurring.paidBy ??
          "",
        category:
          recurring.recurringExpenseCategory ??
          recurring.expenseCategory ??
          recurring.category ??
          "",
        subcategory:
          recurring.recurringExpenseSubcategory ??
          recurring.expenseSubcategory ??
          "",
        amount: recurring.price,
        effectiveAmount: recurring.price,
        effectiveAmountMode: "auto",
        date: runDate,
        paidTo:
          recurring.recurringExpensePaidTo ??
          recurring.expensePaidTo ??
          recurring.paidTo ??
          "",
        notes: recurring.notes,
        comments: `Triggered at ${formatJerusalemNow()}`,
        expenseId: automationKey,
        baseExpenseId: automationKey,
        subExpenseId: "000",
      });
      created++;
    }

    return { runDate, day, matched: due.length, created, skipped };
  },
});