import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.float64()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("username", ["username"]),
  expenses: defineTable({
    userId: v.optional(v.id("users")),
    expense: v.string(),
    type: v.optional(v.string()),
    account: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    amount: v.number(),
    effectiveAmount: v.optional(v.number()),
    effectiveAmountMode: v.optional(
      v.union(v.literal("auto"), v.literal("manual")),
    ),
    monthYears: v.array(v.string()),
    date: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    expenseId: v.string(),
    baseExpenseId: v.optional(v.string()),
    baseExpenseLabel: v.optional(v.string()),
    subExpenseId: v.optional(v.string()),
  })
    .index("by_user_id_date", ["userId", "date"])
    .index("by_user_account_date", ["userId", "account", "date"])
    .index("by_user_id", ["userId"])
    .index("by_expense_id", ["expenseId"])
    .index("by_user_base_expense_id", ["userId", "baseExpenseId"])
    .index("by_date", ["date"]),
  incomings: defineTable({
    userId: v.optional(v.id("users")),
    incoming: v.string(),
    paidBy: v.string(),
    incomeType: v.string(),
    incomeSubtype: v.optional(v.string()),
    account: v.string(),
    amount: v.number(),
    effectiveAmount: v.optional(v.number()),
    effectiveAmountMode: v.optional(
      v.union(v.literal("auto"), v.literal("manual")),
    ),
    date: v.string(),
    monthYears: v.array(v.string()),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    incomingId: v.string(),
    baseIncomingId: v.optional(v.string()),
    subIncomingId: v.optional(v.string()),
  })
    .index("by_user_id_date", ["userId", "date"])
    .index("by_user_id", ["userId"])
    .index("by_incoming_id", ["incomingId"])
    .index("by_user_base_incoming_id", ["userId", "baseIncomingId"])
    .index("by_date", ["date"]),
  paybackLinks: defineTable({
    userId: v.optional(v.id("users")),
    expenseId: v.id("expenses"),
    incomingId: v.id("incomings"),
    allocatedAmount: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_expense", ["userId", "expenseId"])
    .index("by_user_incoming", ["userId", "incomingId"])
    .index("by_user_pair", ["userId", "expenseId", "incomingId"])
    .index("by_user_id", ["userId"]),
  userOptions: defineTable({
    userId: v.optional(v.id("users")),
    kind: v.union(
      v.literal("expenseType"),
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
  })
    .index("by_user_kind", ["userId", "kind"])
    .index("by_user_kind_value", ["userId", "kind", "value"]),
  recurrings: defineTable({
    userId: v.optional(v.id("users")),
    status: v.string(),
    kind: v.optional(v.union(v.literal("expense"), v.literal("incoming"))),
    name: v.string(),
    amount: v.number(),
    frequency: v.string(),
    dayOfMonth: v.number(),
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
  })
    .index("by_day_of_month", ["dayOfMonth"])
    .index("by_user_id_day_of_month", ["userId", "dayOfMonth"])
    .index("by_user_id", ["userId"]),
  notepadWorkspaces: defineTable({
    userId: v.optional(v.id("users")),
    notes: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          content: v.string(),
        }),
      ),
    ),
    tables: v.optional(
      v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          cells: v.array(v.array(v.string())),
        }),
      ),
    ),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
});
