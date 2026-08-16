import { asUser, createUser, expenseInput, incomingInput, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex tracking", () => {
  it("requires authentication and returns only tracked options", async () => {
    const t = makeConvexTest();
    await expect(t.query(testApi.tracking.list, {})).rejects.toThrow(
      "Unauthenticated",
    );

    const alice = await createUser(t, "tracking-alice");
    const bob = await createUser(t, "tracking-bob");
    const client = asUser(t, alice);
    const bobClient = asUser(t, bob);
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Food",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Untracked",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: "Restaurant",
      parentValue: "Food",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "incomeType",
      value: "Work",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "incomeSubtype",
      value: "Salary",
      parentValue: "Work",
    });
    await client.mutation(testApi.userOptions.setTracking, {
      kind: "category",
      value: "Food",
      isTracking: true,
    });
    await client.mutation(testApi.userOptions.setTracking, {
      kind: "subcategory",
      value: "Restaurant",
      parentValue: "Food",
      isTracking: true,
    });
    await client.mutation(testApi.userOptions.setTracking, {
      kind: "incomeType",
      value: "Work",
      isTracking: true,
    });
    await client.mutation(testApi.userOptions.setTracking, {
      kind: "incomeSubtype",
      value: "Salary",
      parentValue: "Work",
      isTracking: true,
    });

    await client.mutation(
      testApi.expenses.create,
      expenseInput("tracked-food", {
        category: "Food",
        subcategory: "Restaurant",
        monthYears: ["2025-01", "2025-03"],
        date: "2025-01-05",
      }),
    );
    await client.mutation(
      testApi.incomings.create,
      incomingInput("tracked-salary", {
        incomeType: "Work",
        incomeSubtype: "Salary",
        monthYears: ["2025-02"],
        date: "2025-02-05",
      }),
    );
    await bobClient.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Private",
    });
    await bobClient.mutation(testApi.userOptions.setTracking, {
      kind: "category",
      value: "Private",
      isTracking: true,
    });

    const result = await client.query(testApi.tracking.list, {});
    expect(result.rows).toHaveLength(4);
    const category = result.rows.find((row) => row.kind === "category");
    const subcategory = result.rows.find((row) => row.kind === "subcategory");
    const incomeType = result.rows.find((row) => row.kind === "incomeType");
    const incomeSubtype = result.rows.find(
      (row) => row.kind === "incomeSubtype",
    );
    expect(category).toMatchObject({
      source: "expense",
      value: "Food",
      paidMonths: ["2025-01", "2025-03"],
      statusByMonth: {
        "2025-01": "paid",
        "2025-02": "unpaid",
        "2025-03": "paid",
      },
    });
    expect(subcategory).toMatchObject({
      label: "Food / Restaurant",
      paidMonths: ["2025-01", "2025-03"],
    });
    expect(incomeType).toMatchObject({
      source: "incoming",
      paidMonths: ["2025-02"],
    });
    expect(incomeSubtype).toMatchObject({
      label: "Work / Salary",
      paidMonths: ["2025-02"],
    });
    expect(result.rows.some((row) => row.value === "Untracked")).toBe(false);
    expect(result.rows.some((row) => row.value === "Private")).toBe(false);
    expect(result.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("rejects tracking on account options", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "tracking-account-user");
    const client = asUser(t, user);
    await client.mutation(testApi.userOptions.add, {
      kind: "account",
      value: "Checking",
    });
    await expect(
      client.mutation(testApi.userOptions.setTracking, {
        kind: "account",
        value: "Checking",
        isTracking: true,
      }),
    ).rejects.toThrow("only supported");
  });
});