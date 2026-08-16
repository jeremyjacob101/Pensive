import { asUser, createUser, expenseInput, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex expenses", () => {
  it("requires authentication", async () => {
    const t = makeConvexTest();
    await expect(
      t.query(testApi.expenses.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("creates normalized expenses and isolates users", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "alice");
    const bob = await createUser(t, "bob");
    const aliceClient = asUser(t, alice);
    const bobClient = asUser(t, bob);

    const id = await aliceClient.mutation(
      testApi.expenses.create,
      expenseInput("expense-a", {
        date: "1/5/2025",
        monthYears: ["2025-02", "2025-01", "2025-02"],
        account: "  Checking  ",
      }),
    );

    const aliceRows = await aliceClient.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const bobRows = await bobClient.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });

    expect(aliceRows.page).toHaveLength(1);
    expect(aliceRows.page[0]).toMatchObject({
      _id: id,
      date: "2025-01-05",
      monthYears: ["2025-01", "2025-02"],
      account: "  Checking  ",
      effectiveAmount: 100,
      effectiveAmountMode: "auto",
    });
    expect(bobRows.page).toHaveLength(0);

    await expect(
      bobClient.mutation(testApi.expenses.update, {
        ...expenseInput("attempted-cross-user-update"),
        id,
      }),
    ).rejects.toThrow("Not found");
  });

  it("supports bulk creation, visible patching, and date/month overlap queries", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "bulk-user");
    const client = asUser(t, user);

    const result = await client.mutation(testApi.expenses.bulkCreate, {
      rows: [
        expenseInput("expense-jan", {
          date: "2025-01-05",
          monthYears: ["2025-01"],
        }),
        expenseInput("expense-feb", {
          date: "2025-02-05",
          monthYears: ["2025-02"],
        }),
        expenseInput("expense-overlap", {
          date: "2024-12-31",
          monthYears: ["2025-01"],
        }),
      ],
    });
    expect(result).toEqual({ inserted: 3 });

    const overlap = await client.query(testApi.expenses.listByDateScope, {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      targetMonths: ["2025-01"],
      includeMonthYearOverlapOutsideDate: true,
    });
    expect(overlap.map((row) => row.expenseId)).toEqual([
      "expense-jan",
      "expense-overlap",
    ]);

    const page = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 1 },
    });
    expect(page.page).toHaveLength(1);

    const patched = await client.mutation(testApi.expenses.bulkPatchVisible, {
      ids: [page.page[0]._id, page.page[0]._id],
      patch: { notes: "  patched  ", comments: null },
    });
    expect(patched).toEqual({ updatedCount: 1 });
    const updated = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(updated.page[0]).toMatchObject({ notes: "patched" });
    expect(updated.page[0].comments).toBeUndefined();
  });

  it("preserves manual effective amounts through updates", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "manual-user");
    const client = asUser(t, user);
    const id = await client.mutation(
      testApi.expenses.create,
      expenseInput("manual-expense", {
        effectiveAmount: 40,
        effectiveAmountMode: "manual",
      }),
    );

    await client.mutation(testApi.expenses.update, {
      ...expenseInput("manual-expense", { amount: 200 }),
      id,
    });
    const rows = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page[0]).toMatchObject({ amount: 200, effectiveAmount: 40 });
  });

  it("groups, unlinks, and removes base expenses", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "group-user");
    const client = asUser(t, user);
    const first = await client.mutation(
      testApi.expenses.create,
      expenseInput("group-a"),
    );
    const second = await client.mutation(
      testApi.expenses.create,
      expenseInput("group-b", { expense: "Dinner" }),
    );

    const linked = await client.mutation(
      testApi.expenses.linkExistingExpenses,
      {
        expenseIds: [first, second],
        baseExpenseLabel: " Shared meals ",
      },
    );
    expect(linked).toMatchObject({
      linked: 2,
      baseExpenseId: "group-a",
      baseExpenseLabel: "Shared meals",
    });

    await expect(
      client.mutation(testApi.expenses.linkExistingExpenses, {
        expenseIds: [first],
      }),
    ).rejects.toThrow("at least two");
    await client.mutation(testApi.expenses.removeBaseExpense, {
      baseExpenseId: "group-a",
    });
    const rows = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page).toHaveLength(0);

    const third = await client.mutation(
      testApi.expenses.create,
      expenseInput("group-c"),
    );
    const fourth = await client.mutation(
      testApi.expenses.create,
      expenseInput("group-d"),
    );
    await client.mutation(testApi.expenses.linkExistingExpenses, {
      expenseIds: [third, fourth],
      baseExpenseLabel: "Another group",
    });
    const unlinked = await client.mutation(
      testApi.expenses.unlinkExpenseFromPartners,
      {
        expenseId: fourth,
      },
    );
    expect(unlinked).toMatchObject({ unlinked: 1, remainingLinked: 1 });
  });
});