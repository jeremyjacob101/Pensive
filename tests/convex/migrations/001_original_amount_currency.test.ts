import { asUser, createUser, internalApi, makeConvexTest, testApi } from "../support";
import { describe, expect, it } from "vitest";

describe("migration 001: original amount and currency", () => {
  it("backfills legacy ledger rows in repeatable batches", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "amount-migration-user");

    const ids = await t.run(async (ctx) => {
      const expenseId = await ctx.db.insert("expenses", {
        userId: user,
        expense: "Legacy expense",
        account: "Checking",
        category: "Food",
        amount: 42,
        monthYears: ["2025-01"],
        date: "2025-01-01",
        paidTo: "Cafe",
        expenseId: "legacy-expense",
      });
      const incomingId = await ctx.db.insert("incomings", {
        userId: user,
        incoming: "Legacy incoming",
        paidBy: "Employer",
        incomeType: "Work",
        account: "Checking",
        amount: 84,
        date: "2025-01-02",
        monthYears: ["2025-01"],
        incomingId: "legacy-incoming",
      });
      const recurringId = await ctx.db.insert("recurrings", {
        userId: user,
        status: "active",
        kind: "expense",
        name: "Legacy recurring",
        amount: 21,
        frequency: "Monthly",
        dayOfMonth: 1,
      });
      return { expenseId, incomingId, recurringId };
    });

    const client = asUser(t, user);
    const legacyPage = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(legacyPage.page[0]).toMatchObject({
      _id: ids.expenseId,
      amount: 42,
      originalAmount: 42,
      originalCurrency: "ILS",
    });

    for (const table of ["expenses", "incomings", "recurrings"] as const) {
      const first = await t.mutation(
        internalApi.migrations["001_original_amount_currency"].backfillBatch,
        { table, batchSize: 1 },
      );
      expect(first).toMatchObject({
        table,
        scanned: 1,
        patched: 1,
        done: false,
      });

      const second = await t.mutation(
        internalApi.migrations["001_original_amount_currency"].backfillBatch,
        { table, batchSize: 1 },
      );
      expect(second).toMatchObject({
        table,
        scanned: 0,
        patched: 0,
        done: true,
      });
    }

    const verification = await t.query(
      internalApi.migrations["001_original_amount_currency"].verify,
      {},
    );
    expect(verification).toEqual({
      expenses: { total: 1, missing: 0 },
      incomings: { total: 1, missing: 0 },
      recurrings: { total: 1, missing: 0 },
    });

    const rerun = await t.mutation(
      internalApi.migrations["001_original_amount_currency"].backfillBatch,
      {
        table: "expenses",
        batchSize: 1,
      },
    );
    expect(rerun).toMatchObject({ scanned: 0, patched: 0, done: true });
  });
});