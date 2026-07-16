import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { normalizeMonthYearsInput } from "./monthYears";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const RECURRING_FREQUENCY = "Monthly";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthenticated");
  return userId;
}

const recurringArgs = {
  status: v.string(),
  kind: v.union(v.literal("expense"), v.literal("incoming")),
  name: v.string(),
  amount: v.number(),
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
} as const;

function validateRecurringFields(args: {
  kind: "expense" | "incoming";
  recurringExpenseAccount?: string;
  recurringExpenseCategory?: string;
  recurringExpensePaidTo?: string;
  recurringIncomingPaidBy?: string;
  recurringIncomingType?: string;
  recurringIncomingAccount?: string;
}) {
  if (args.kind === "expense") {
    if (
      !args.recurringExpenseAccount ||
      !args.recurringExpenseCategory ||
      !args.recurringExpensePaidTo
    ) {
      throw new Error("Missing required expense recurring fields");
    }
    return;
  }
  if (
    !args.recurringIncomingPaidBy ||
    !args.recurringIncomingType ||
    !args.recurringIncomingAccount
  ) {
    throw new Error("Missing required incoming recurring fields");
  }
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
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
  args: recurringArgs,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    validateRecurringFields(args);
    return await ctx.db.insert("recurrings", {
      ...args,
      frequency: RECURRING_FREQUENCY,
      ...(args.kind === "expense"
        ? {
            recurringIncomingPaidBy: undefined,
            recurringIncomingType: undefined,
            recurringIncomingSubtype: undefined,
            recurringIncomingAccount: undefined,
          }
        : {
            recurringExpenseAccount: undefined,
            recurringExpenseCategory: undefined,
            recurringExpenseSubcategory: undefined,
            recurringExpensePaidTo: undefined,
          }),
      userId,
    });
  },
});

export const bulkCreate = mutation({
  args: { rows: v.array(v.object(recurringArgs)) },
  handler: async (ctx, { rows }) => {
    const userId = await requireUserId(ctx);
    for (const row of rows) {
      validateRecurringFields(row);
      await ctx.db.insert("recurrings", {
        ...row,
        frequency: RECURRING_FREQUENCY,
        userId,
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
      .query("recurrings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .take(limit);
    for (const doc of docs) await ctx.db.delete(doc._id);
    return { deleted: docs.length, done: docs.length < limit };
  },
});

export const update = mutation({
  args: { id: v.id("recurrings"), ...recurringArgs },
  handler: async (ctx, { id, ...rest }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    validateRecurringFields(rest);
    await ctx.db.patch(id, {
      ...rest,
      frequency: RECURRING_FREQUENCY,
      ...(rest.kind === "expense"
        ? {
            recurringIncomingPaidBy: undefined,
            recurringIncomingType: undefined,
            recurringIncomingSubtype: undefined,
            recurringIncomingAccount: undefined,
          }
        : {
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
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, { status });
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
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(id as Id<"recurrings">);
    return id;
  },
});

export const materializeDueExpenses = mutation({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const userId = await requireUserId(ctx);
    return await materializeDueExpensesForSingleUser(ctx, userId, runDate);
  },
});

export const materializeDueExpensesForUser = internalMutation({
  args: { userId: v.id("users"), runDate: v.string() },
  handler: async (ctx, { userId, runDate }) => {
    return await materializeDueExpensesForSingleUser(ctx, userId, runDate);
  },
});

export const materializeDueExpensesForAllUsers = internalMutation({
  args: { runDate: v.string() },
  handler: async (ctx, { runDate }) => {
    const day = parseDay(runDate);
    const due = await ctx.db
      .query("recurrings")
      .withIndex("by_day_of_month", (q) => q.eq("dayOfMonth", day))
      .collect();

    let created = 0;
    let skipped = 0;
    let usersProcessed = 0;
    let skippedNoUser = 0;
    const processedUserIds = new Set<string>();

    for (const recurring of due) {
      if (!recurring.userId) {
        skippedNoUser++;
        continue;
      }
      if (!processedUserIds.has(recurring.userId)) {
        processedUserIds.add(recurring.userId);
        usersProcessed++;
      }
      const result = await materializeRecurringRow(
        ctx,
        recurring.userId,
        recurring,
        runDate,
      );
      created += result.created;
      skipped += result.skipped;
    }

    return {
      runDate,
      day,
      matched: due.length,
      usersProcessed,
      skippedNoUser,
      created,
      skipped,
    };
  },
});

function parseDay(runDate: string) {
  const day = Number(runDate.split("-")[2] ?? "0");
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    throw new Error("runDate must be YYYY-MM-DD");
  }
  return day;
}

async function materializeDueExpensesForSingleUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  runDate: string,
) {
  const day = parseDay(runDate);

  const due = await ctx.db
    .query("recurrings")
    .withIndex("by_user_id_day_of_month", (q) =>
      q.eq("userId", userId).eq("dayOfMonth", day))
    .collect();

  let created = 0;
  let skipped = 0;

  for (const recurring of due) {
    const result = await materializeRecurringRow(
      ctx,
      userId,
      recurring,
      runDate,
    );
    created += result.created;
    skipped += result.skipped;
  }

  return { runDate, day, matched: due.length, created, skipped };
}

async function materializeRecurringRow(
  ctx: MutationCtx,
  userId: Id<"users">,
  recurring: {
    _id: Id<"recurrings">;
    status: string;
    kind?: "expense" | "incoming";
    name: string;
    recurringIncomingPaidBy?: string;
    recurringIncomingType?: string;
    recurringIncomingSubtype?: string;
    recurringIncomingAccount?: string;
    amount: number;
    notes?: string;
    recurringExpenseAccount?: string;
    recurringExpenseCategory?: string;
    recurringExpenseSubcategory?: string;
    recurringExpensePaidTo?: string;
  },
  runDate: string,
) {
  if (recurring.status.toLowerCase() !== "active")
    return { created: 0, skipped: 1 };
  const kind = recurring.kind ?? "expense";
  const automationKey = `recurring:${kind}:${recurring._id}:${runDate}`;

  if (kind === "incoming") {
    const monthYears = normalizeMonthYearsInput([], runDate);
    const alreadyIncoming = await ctx.db
      .query("incomings")
      .withIndex("by_incoming_id", (q) => q.eq("incomingId", automationKey))
      .first();
    if (alreadyIncoming) return { created: 0, skipped: 1 };
    await ctx.db.insert("incomings", {
      userId,
      incoming: recurring.name,
      paidBy: recurring.recurringIncomingPaidBy ?? "",
      incomeType: recurring.recurringIncomingType ?? "",
      incomeSubtype: recurring.recurringIncomingSubtype ?? "",
      account: recurring.recurringIncomingAccount ?? "",
      amount: recurring.amount,
      effectiveAmount: recurring.amount,
      effectiveAmountMode: "auto",
      date: runDate,
      monthYears,
      notes: recurring.notes,
      comments: `Triggered at ${formatJerusalemNow()}`,
      incomingId: automationKey,
    });
    return { created: 1, skipped: 0 };
  }

  const alreadyExpense = await ctx.db
    .query("expenses")
    .withIndex("by_expense_id", (q) => q.eq("expenseId", automationKey))
    .first();
  if (alreadyExpense) return { created: 0, skipped: 1 };
  await ctx.db.insert("expenses", {
    monthYears: normalizeMonthYearsInput([], runDate),
    userId,
    expense: recurring.name,
    account: recurring.recurringExpenseAccount ?? "",
    category: recurring.recurringExpenseCategory ?? "",
    subcategory: recurring.recurringExpenseSubcategory ?? "",
    amount: recurring.amount,
    effectiveAmount: recurring.amount,
    effectiveAmountMode: "auto",
    date: runDate,
    paidTo: recurring.recurringExpensePaidTo ?? "",
    notes: recurring.notes,
    comments: `Triggered at ${formatJerusalemNow()}`,
    expenseId: automationKey,
  });
  return { created: 1, skipped: 0 };
}