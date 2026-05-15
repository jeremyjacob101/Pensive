import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  expenses: defineTable({
    userId: v.optional(v.id("users")),
    expense: v.string(),
    type: v.string(),
    account: v.string(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    amount: v.number(),
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
    date: v.string(),
    monthYear: v.string(),
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
  })
    .index("by_user_kind", ["userId", "kind"])
    .index("by_user_kind_value", ["userId", "kind", "value"]),
  recurrings: defineTable({
    userId: v.optional(v.id("users")),
    status: v.string(),
    kind: v.optional(v.union(v.literal("expense"), v.literal("incoming"))),
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
    notes: v.optional(v.string()),
  })
    .index("by_day_of_month", ["dayOfMonth"])
    .index("by_user_id_day_of_month", ["userId", "dayOfMonth"])
    .index("by_user_id", ["userId"]),
});
