import { asUser, createUser, expenseInput, incomingInput, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex summaries", () => {
  it("requires authentication and returns zero totals for an invalid range", async () => {
    const t = makeConvexTest();
    await expect(
      t.query(testApi.summaries.range, {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      }),
    ).rejects.toThrow("Unauthenticated");

    const user = await createUser(t, "summary-empty-user");
    const result = await asUser(t, user).query(testApi.summaries.range, {
      startDate: "not-a-date",
      endDate: "also-not-a-date",
    });
    expect(result).toMatchObject({
      totals: {
        rawExpenses: 0,
        effectiveExpenses: 0,
        rawIncomings: 0,
        effectiveIncomings: 0,
        rawNet: 0,
        effectiveNet: 0,
      },
      monthlyBuckets: [],
    });
  });

  it("prorates multi-month rows, uses effective amounts, and computes net totals", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "summary-alice");
    const bob = await createUser(t, "summary-bob");
    const client = asUser(t, alice);
    const bobClient = asUser(t, bob);

    await client.mutation(
      testApi.expenses.create,
      expenseInput("summary-jan", {
        amount: 100,
        effectiveAmount: 80,
        effectiveAmountMode: "manual",
        date: "2025-01-10",
        monthYears: ["2025-01"],
      }),
    );
    await client.mutation(
      testApi.expenses.create,
      expenseInput("summary-spanning", {
        amount: 200,
        effectiveAmount: 100,
        effectiveAmountMode: "manual",
        date: "2025-01-20",
        monthYears: ["2025-01", "2025-02"],
      }),
    );
    await client.mutation(
      testApi.expenses.create,
      expenseInput("summary-overlap", {
        amount: 60,
        date: "2024-12-31",
        monthYears: ["2025-01"],
      }),
    );
    await client.mutation(
      testApi.incomings.create,
      incomingInput("summary-income", {
        amount: 300,
        effectiveAmount: 270,
        effectiveAmountMode: "manual",
        date: "2025-01-25",
        monthYears: ["2025-01"],
      }),
    );
    await bobClient.mutation(
      testApi.expenses.create,
      expenseInput("bob-summary", {
        amount: 999,
        date: "2025-01-01",
        monthYears: ["2025-01"],
      }),
    );

    const result = await client.query(testApi.summaries.range, {
      startDate: "2025-01-01",
      endDate: "2025-02-28",
    });
    expect(result.totals).toEqual({
      rawExpenses: 360,
      effectiveExpenses: 240,
      rawIncomings: 300,
      effectiveIncomings: 270,
      rawNet: -60,
      effectiveNet: 30,
    });
    expect(result.monthlyBuckets).toEqual([
      {
        month: "2025-01",
        rawExpenses: 260,
        effectiveExpenses: 190,
        rawIncomings: 300,
        effectiveIncomings: 270,
        rawNet: 40,
        effectiveNet: 80,
      },
      {
        month: "2025-02",
        rawExpenses: 100,
        effectiveExpenses: 50,
        rawIncomings: 0,
        effectiveIncomings: 0,
        rawNet: -100,
        effectiveNet: -50,
      },
    ]);
  });
});