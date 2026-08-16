import { asUser, createUser, expenseInput, incomingInput, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex payback links", () => {
  it("recomputes both effective amounts and reports over-allocation", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "payback-user");
    const client = asUser(t, user);
    const expenseId = await client.mutation(
      testApi.expenses.create,
      expenseInput("payback-expense", { amount: 100 }),
    );
    const incomingId = await client.mutation(
      testApi.incomings.create,
      incomingInput("payback-incoming", { amount: 80 }),
    );

    const link = await client.mutation(testApi.paybackLinks.create, {
      expenseId,
      incomingId,
      allocatedAmount: 30,
      notes: "  reimbursement  ",
    });
    expect(link).toMatchObject({ id: expect.any(String), warnings: [] });

    const links = await client.query(testApi.paybackLinks.listForExpense, {
      expenseId,
    });
    expect(links[0]).toMatchObject({
      allocatedAmount: 30,
      notes: "reimbursement",
    });

    const expenseRows = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const incomingRows = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(expenseRows.page[0]).toMatchObject({ effectiveAmount: 70 });
    expect(incomingRows.page[0]).toMatchObject({ effectiveAmount: 50 });

    const updated = await client.mutation(testApi.paybackLinks.update, {
      id: link.id,
      allocatedAmount: 120,
      notes: "updated",
    });
    expect(updated.warnings).toEqual([
      expect.objectContaining({ kind: "expense", overAllocatedBy: 20 }),
      expect.objectContaining({ kind: "incoming", overAllocatedBy: 40 }),
    ]);
  });

  it("prevents duplicate links and cross-user linking", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "payback-alice");
    const bob = await createUser(t, "payback-bob");
    const aliceClient = asUser(t, alice);
    const bobClient = asUser(t, bob);
    const expenseId = await aliceClient.mutation(
      testApi.expenses.create,
      expenseInput("alice-expense"),
    );
    const incomingId = await aliceClient.mutation(
      testApi.incomings.create,
      incomingInput("alice-incoming"),
    );
    const bobIncomingId = await bobClient.mutation(
      testApi.incomings.create,
      incomingInput("bob-incoming"),
    );

    await aliceClient.mutation(testApi.paybackLinks.create, {
      expenseId,
      incomingId,
      allocatedAmount: 10,
    });
    await expect(
      aliceClient.mutation(testApi.paybackLinks.create, {
        expenseId,
        incomingId,
        allocatedAmount: 5,
      }),
    ).rejects.toThrow(/already linked|duplicate|once/i);
    await expect(
      aliceClient.mutation(testApi.paybackLinks.create, {
        expenseId,
        incomingId: bobIncomingId,
        allocatedAmount: 5,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("deletes links when an expense is deleted", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "delete-payback-user");
    const client = asUser(t, user);
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
    await client.mutation(testApi.expenses.remove, { id: expenseId });
    expect(
      await client.query(testApi.paybackLinks.listForIncoming, { incomingId }),
    ).toMatchObject({
      length: 0,
    });
    const rows = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page[0]).toMatchObject({ effectiveAmount: 200 });
  });
});