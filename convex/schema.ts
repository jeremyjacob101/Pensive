import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  expenses: defineTable({
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
    .index("by_expense_id", ["expenseId"])
    .index("by_date", ["date"])
    .index("by_automation_key", ["automationKey"]),
  incomings: defineTable({
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
    .index("by_incoming_id", ["incomingId"])
    .index("by_date", ["date"]),
  recurrings: defineTable({
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
  }).index("by_day_of_month", ["dayOfMonth"]),
});
