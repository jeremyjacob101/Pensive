import type { Id } from "../../convex/_generated/dataModel";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { convexTest } from "convex-test";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

export const testApi = api;
export const internalApi = internal;

export function makeConvexTest() {
  return convexTest({ schema, modules });
}

export type ConvexTest = ReturnType<typeof makeConvexTest>;

export async function createUser(
  t: ConvexTest,
  username: string,
): Promise<Id<"users">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("users", {
        username,
        name: username,
        email: `${username}@test.invalid`,
        isAnonymous: false,
      }),
  );
}

export function asUser(t: ConvexTest, userId: Id<"users">) {
  return t.withIdentity({ subject: userId });
}

export function expenseInput(
  expenseId: string,
  overrides: Partial<{
    expense: string;
    account: string;
    category: string;
    subcategory: string;
    amount: number;
    effectiveAmount: number;
    effectiveAmountMode: "auto" | "manual";
    monthYears: string[];
    date: string;
    paidTo: string;
    notes: string;
    comments: string;
    baseExpenseId: string;
    baseExpenseLabel: string;
    subExpenseId: string;
  }> = {},
) {
  return {
    expense: "Lunch",
    account: "Checking",
    category: "Food",
    subcategory: "Restaurant",
    amount: 100,
    date: "2025-01-15",
    paidTo: "Cafe",
    notes: "test note",
    comments: "test comment",
    expenseId,
    ...overrides,
  };
}

export function incomingInput(
  incomingId: string,
  overrides: Partial<{
    incoming: string;
    paidBy: string;
    incomeType: string;
    incomeSubtype: string;
    account: string;
    amount: number;
    effectiveAmount: number;
    effectiveAmountMode: "auto" | "manual";
    date: string;
    monthYears: string[];
    notes: string;
    comments: string;
    baseIncomingId: string;
    subIncomingId: string;
  }> = {},
) {
  return {
    incoming: "Salary",
    paidBy: "Employer",
    incomeType: "Work",
    incomeSubtype: "Salary",
    account: "Checking",
    amount: 200,
    date: "2025-01-20",
    notes: "test note",
    comments: "test comment",
    incomingId,
    ...overrides,
  };
}

export function recurringExpenseInput(name = "Rent") {
  return {
    status: "active" as const,
    kind: "expense" as const,
    name,
    amount: 50,
    frequency: "Monthly",
    dayOfMonth: 15,
    recurringExpenseAccount: "Checking",
    recurringExpenseCategory: "Housing",
    recurringExpenseSubcategory: "Rent",
    recurringExpensePaidTo: "Landlord",
    notes: "recurring test",
  };
}

export function recurringIncomingInput(name = "Payday") {
  return {
    status: "active" as const,
    kind: "incoming" as const,
    name,
    amount: 500,
    frequency: "Monthly",
    dayOfMonth: 15,
    recurringIncomingPaidBy: "Employer",
    recurringIncomingType: "Work",
    recurringIncomingSubtype: "Salary",
    recurringIncomingAccount: "Checking",
    notes: "recurring test",
  };
}