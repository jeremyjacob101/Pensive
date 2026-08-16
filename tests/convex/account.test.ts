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

    const result = await client.mutation(testApi.account.deleteMine, {});
    expect(result.deleted).toBeGreaterThanOrEqual(7);

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
    }));
    expect(remaining).toEqual({
      user: null,
      expenses: [],
      incomings: [],
      paybacks: [],
      recurrings: [],
      options: [],
      notepad: [],
    });
    expect(
      await bobClient.query(testApi.expenses.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).toMatchObject({ page: [{ expenseId: "preserved-expense" }] });
  });
});