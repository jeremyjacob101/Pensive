import { asUser, createUser, expenseInput, incomingInput, internalApi, makeConvexTest, recurringExpenseInput, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("original amount and currency migration", () => {
  it("keeps canonical rows and makes the backfill a safe no-op after Release A", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "amount-migration-user");
    const client = asUser(t, user);

    const expenseId = await client.mutation(
      testApi.expenses.create,
      expenseInput("canonical-expense", { amount: 42 }),
    );
    await client.mutation(
      testApi.incomings.create,
      incomingInput("canonical-incoming", { amount: 84 }),
    );
    await client.mutation(
      testApi.recurrings.create,
      recurringExpenseInput("canonical-recurring"),
    );

    const page = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(page.page[0]).toMatchObject({
      _id: expenseId,
      amount: 42,
      originalAmount: 42,
      originalCurrency: "ILS",
    });

    const storedExpense = await t.run((ctx) => ctx.db.get(expenseId));
    expect(storedExpense).toMatchObject({
      originalAmount: 42,
      originalCurrency: "ILS",
    });
    expect(storedExpense?.amount).toBeUndefined();

    for (const table of ["expenses", "incomings", "recurrings"] as const) {
      const result = await t.mutation(
        internalApi.amountMigrations.backfillBatch,
        { table, batchSize: 1 },
      );
      expect(result).toMatchObject({
        table,
        scanned: 0,
        patched: 0,
        done: true,
      });
    }

    const verification = await t.query(internalApi.amountMigrations.verify, {});
    expect(verification).toEqual({
      expenses: { total: 1, missing: 0 },
      incomings: { total: 1, missing: 0 },
      recurrings: { total: 1, missing: 0 },
    });
  });
});