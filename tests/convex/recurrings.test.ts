import { asUser, createUser, makeConvexTest, recurringExpenseInput, recurringIncomingInput, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex recurring entries", () => {
  it("requires authentication and validates kind-specific fields", async () => {
    const t = makeConvexTest();
    await expect(
      t.query(testApi.recurrings.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("Unauthenticated");

    const user = await createUser(t, "recurring-validation-user");
    const client = asUser(t, user);
    await expect(
      client.mutation(testApi.recurrings.create, {
        ...recurringExpenseInput(),
        recurringExpenseCategory: undefined,
      }),
    ).rejects.toThrow("expense recurring fields");
    await expect(
      client.mutation(testApi.recurrings.create, {
        ...recurringIncomingInput(),
        recurringIncomingAccount: undefined,
      }),
    ).rejects.toThrow("incoming recurring fields");
  });

  it("normalizes frequency, clears opposite-kind fields, updates status, and isolates users", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "recurring-alice");
    const bob = await createUser(t, "recurring-bob");
    const client = asUser(t, alice);
    const bobClient = asUser(t, bob);
    const id = await client.mutation(testApi.recurrings.create, {
      ...recurringExpenseInput("monthly-expense"),
      frequency: "Weekly",
      recurringIncomingPaidBy: "should be cleared",
      recurringIncomingType: "should be cleared",
      recurringIncomingAccount: "should be cleared",
    });

    let rows = await client.query(testApi.recurrings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page[0]).toMatchObject({
      _id: id,
      frequency: "Monthly",
    });
    expect(rows.page[0]).not.toHaveProperty("recurringIncomingType");

    await client.mutation(testApi.recurrings.update, {
      ...recurringIncomingInput("monthly-income"),
      id,
      frequency: "Yearly",
      recurringExpenseAccount: "cleared",
      recurringExpenseCategory: "cleared",
      recurringExpensePaidTo: "cleared",
    });
    await client.mutation(testApi.recurrings.setStatus, {
      id,
      status: "inactive",
    });
    rows = await client.query(testApi.recurrings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page[0]).toMatchObject({
      kind: "incoming",
      frequency: "Monthly",
      status: "inactive",
    });
    expect(rows.page[0]).not.toHaveProperty("recurringExpenseCategory");
    expect(
      await bobClient.query(testApi.recurrings.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).toMatchObject({ page: [] });
    await expect(
      bobClient.mutation(testApi.recurrings.setStatus, {
        id,
        status: "active",
      }),
    ).rejects.toThrow("Not found");
  });

  it("bulk creates and clears only the authenticated user's recurring rows", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "recurring-bulk-alice");
    const bob = await createUser(t, "recurring-bulk-bob");
    const client = asUser(t, alice);
    const bobClient = asUser(t, bob);
    const result = await client.mutation(testApi.recurrings.bulkCreate, {
      rows: [recurringExpenseInput("rent"), recurringIncomingInput("salary")],
    });
    expect(result).toEqual({ inserted: 2 });
    await bobClient.mutation(
      testApi.recurrings.create,
      recurringExpenseInput("bob-rent"),
    );

    const cleared = await client.mutation(testApi.recurrings.clearAll, {
      batchSize: 1,
    });
    expect(cleared).toEqual({ deleted: 1, done: false });
    const clearedRest = await client.mutation(testApi.recurrings.clearAll, {
      batchSize: 10,
    });
    expect(clearedRest).toEqual({ deleted: 1, done: true });
    expect(
      await bobClient.query(testApi.recurrings.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).toMatchObject({ page: [{ name: "bob-rent" }] });
  });

  it("materializes active recurring expenses and incomings once per run date", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "recurring-materialize-user");
    const client = asUser(t, user);
    await client.mutation(
      testApi.recurrings.create,
      recurringExpenseInput("automated rent"),
    );
    await client.mutation(
      testApi.recurrings.create,
      recurringIncomingInput("automated salary"),
    );
    await client.mutation(testApi.recurrings.create, {
      ...recurringExpenseInput("inactive rent"),
      status: "inactive",
    });

    const first = await client.mutation(
      testApi.recurrings.materializeDueExpenses,
      {
        runDate: "2025-03-15",
      },
    );
    expect(first).toMatchObject({
      runDate: "2025-03-15",
      day: 15,
      matched: 3,
      created: 2,
      skipped: 1,
    });
    const expenses = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const incomings = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(expenses.page).toHaveLength(1);
    expect(expenses.page[0]).toMatchObject({
      expense: "automated rent",
      date: "2025-03-15",
      expenseId: expect.stringMatching(/^recurring:expense:/),
      effectiveAmount: 50,
    });
    expect(incomings.page).toHaveLength(1);
    expect(incomings.page[0]).toMatchObject({
      incoming: "automated salary",
      date: "2025-03-15",
      incomingId: expect.stringMatching(/^recurring:incoming:/),
      effectiveAmount: 500,
    });

    const second = await client.mutation(
      testApi.recurrings.materializeDueExpenses,
      {
        runDate: "2025-03-15",
      },
    );
    expect(second).toMatchObject({ matched: 3, created: 0, skipped: 3 });
    await expect(
      client.mutation(testApi.recurrings.materializeDueExpenses, {
        runDate: "not-a-date",
      }),
    ).rejects.toThrow("YYYY-MM-DD");
  });

  it("does not materialize recurring rows on a different day", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "recurring-day-user");
    const client = asUser(t, user);
    await client.mutation(
      testApi.recurrings.create,
      recurringExpenseInput("day-15"),
    );
    const result = await client.mutation(
      testApi.recurrings.materializeDueExpenses,
      {
        runDate: "2025-03-16",
      },
    );
    expect(result).toMatchObject({
      day: 16,
      matched: 0,
      created: 0,
      skipped: 0,
    });
  });
});