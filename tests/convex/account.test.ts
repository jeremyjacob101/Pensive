import { asUser, createUser, expenseInput, incomingInput, makeConvexTest, recurringExpenseInput, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex account deletion", () => {
  it("requires authentication", async () => {
    const t = makeConvexTest();
    await expect(t.mutation(testApi.account.deleteMine, {})).rejects.toThrow(
      "Unauthenticated",
    );
  });

  it("deletes all owned application records while preserving another user's data", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "delete-alice");
    const bob = await createUser(t, "delete-bob");
    const client = asUser(t, alice);
    const bobClient = asUser(t, bob);
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Food",
    });
    await client.mutation(testApi.notepad.addNote, {
      noteId: "delete-note",
      content: "private",
    });
    const expenseId = await client.mutation(
      testApi.expenses.create,
      expenseInput("delete-expense"),
    );
    const incomingId = await client.mutation(
      testApi.incomings.create,
      incomingInput("delete-incoming"),
    );
    await client.mutation(testApi.paybackLinks.create, {
      expenseId,
      incomingId,
      allocatedAmount: 10,
    });
    await client.mutation(
      testApi.recurrings.create,
      recurringExpenseInput("delete-recurring"),
    );
    await bobClient.mutation(
      testApi.expenses.create,
      expenseInput("preserved-expense"),
    );
    await client.mutation(testApi.savings.createBank, {
      name: "Alice savings",
      color: "#4389FF",
      interestEnabled: true,
      annualInterestRate: 1,
      compounding: "monthly",
      currency: "ILS",
      startingBalance: 100,
      startingDate: "2026-01-01",
    });
    await client.mutation(testApi.savings.setCurrencySettings, {
      displayCurrency: "USD",
      manualUsdIlsRate: 3.5,
    });
    await bobClient.mutation(testApi.savings.createBank, {
      name: "Bob savings",
      color: "#FF6758",
      interestEnabled: false,
      annualInterestRate: 0,
      compounding: "monthly",
      currency: "USD",
      startingBalance: 200,
      startingDate: "2026-01-01",
    });

    const result = await client.mutation(testApi.account.deleteMine, {});
    expect(result.deleted).toBeGreaterThanOrEqual(10);

    const remaining = await t.run(async (ctx) => ({
      user: await ctx.db.get(alice),
      expenses: await ctx.db
        .query("expenses")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      incomings: await ctx.db
        .query("incomings")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      paybacks: await ctx.db
        .query("paybackLinks")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      recurrings: await ctx.db
        .query("recurrings")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      options: await ctx.db
        .query("userOptions")
        .withIndex("by_user_kind", (q) => q.eq("userId", alice))
        .collect(),
      notepad: await ctx.db
        .query("notepadWorkspaces")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      savingsSettings: await ctx.db
        .query("savingsSettings")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      savingsEntries: await ctx.db
        .query("savingsEntries")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      savingsBanks: await ctx.db
        .query("savingsBanks")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
    }));
    expect(remaining).toEqual({
      user: null,
      expenses: [],
      incomings: [],
      paybacks: [],
      recurrings: [],
      options: [],
      notepad: [],
      savingsSettings: [],
      savingsEntries: [],
      savingsBanks: [],
    });
    expect(
      await bobClient.query(testApi.expenses.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).toMatchObject({ page: [{ expenseId: "preserved-expense" }] });
    expect(
      (await bobClient.query(testApi.savings.list, {})).banks,
    ).toHaveLength(1);
    expect(
      (await bobClient.query(testApi.savings.list, {})).entries,
    ).toHaveLength(1);
  });
});