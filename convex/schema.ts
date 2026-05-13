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
    amount: v.number(),
    date: v.string(),
    paidTo: v.string(),
    notes: v.optional(v.string()),
    comments: v.optional(v.string()),
    expenseId: v.string(),
    automationKey: v.optional(v.string()),
  })
    .index("by_user_id_date", ["userId", "date"])
    .index("by_user_id_automation_key", ["userId", "automationKey"])
    .index("by_user_id", ["userId"])
    .index("by_expense_id", ["expenseId"])
    .index("by_date", ["date"])
    .index("by_automation_key", ["automationKey"]),
  incomings: defineTable({
    userId: v.optional(v.id("users")),
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
  })
    .index("by_user_id_date", ["userId", "date"])
    .index("by_user_id", ["userId"])
    .index("by_incoming_id", ["incomingId"])
    .index("by_date", ["date"]),
  userOptions: defineTable({
    userId: v.optional(v.id("users")),
    kind: v.union(
      v.literal("expenseType"),
      v.literal("account"),
      v.literal("category"),
      v.literal("incomeType"),
    ),
    value: v.string(),
  })
    .index("by_user_kind", ["userId", "kind"])
    .index("by_user_kind_value", ["userId", "kind", "value"]),
  recurrings: defineTable({
    userId: v.optional(v.id("users")),
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
  })
    .index("by_day_of_month", ["dayOfMonth"])
    .index("by_user_id_day_of_month", ["userId", "dayOfMonth"])
    .index("by_user_id", ["userId"]),
});