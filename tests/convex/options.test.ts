import { asUser, createUser, expenseInput, incomingInput, makeConvexTest, recurringExpenseInput, recurringIncomingInput, testApi } from "./support";
import { describe, expect, it } from "vitest";

function optionByValue(
  rows: Array<{ value: string; parentValue?: string }>,
  value: string,
  parentValue?: string,
) {
  return rows.find(
    (row) =>
      row.value === value && (row.parentValue ?? "") === (parentValue ?? ""),
  );
}

describe("Convex user options", () => {
  it("requires authentication and normalizes colors, duplicates, and subtype parents", async () => {
    const t = makeConvexTest();
    await expect(t.query(testApi.userOptions.list, {})).rejects.toThrow(
      "Unauthenticated",
    );

    const user = await createUser(t, "options-basic-user");
    const client = asUser(t, user);
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "  Food  ",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Food",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Housing",
    });
    await expect(
      client.mutation(testApi.userOptions.add, {
        kind: "subcategory",
        value: "Restaurant",
      }),
    ).rejects.toThrow("parentValue");
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: " Restaurant ",
      parentValue: " Food ",
    });

    let options = await client.query(testApi.userOptions.list, {});
    expect(options.category.filter((row) => row.value === "Food")).toHaveLength(
      1,
    );
    expect(
      optionByValue(options.subcategory, "Restaurant", "Food"),
    ).toMatchObject({
      value: "Restaurant",
      parentValue: "Food",
    });
    expect(options.category.find((row) => row.value === "Food")?.color).toMatch(
      /^#[0-9A-F]{6}$/,
    );

    await client.mutation(testApi.userOptions.updateColor, {
      kind: "category",
      value: "Food",
      color: "aabbcc",
    });
    await expect(
      client.mutation(testApi.userOptions.updateColor, {
        kind: "category",
        value: "Food",
        color: "not-a-color",
      }),
    ).rejects.toThrow("hex");

    await client.mutation(testApi.userOptions.setDefault, {
      kind: "category",
      value: "Food",
      isDefault: true,
    });
    await client.mutation(testApi.userOptions.setTracking, {
      kind: "category",
      value: "Food",
      isTracking: true,
    });
    options = await client.query(testApi.userOptions.list, {});
    expect(options.category.find((row) => row.value === "Food")).toMatchObject({
      color: "#AABBCC",
      isDefault: true,
      isTracking: true,
    });

    await client.mutation(testApi.userOptions.setDefault, {
      kind: "subcategory",
      value: "Restaurant",
      parentValue: "Food",
      isDefault: true,
    });
    await client.mutation(testApi.userOptions.setTracking, {
      kind: "subcategory",
      value: "Restaurant",
      parentValue: "Food",
      isTracking: true,
    });
    options = await client.query(testApi.userOptions.list, {});
    expect(
      optionByValue(options.subcategory, "Restaurant", "Food"),
    ).toMatchObject({
      isDefault: true,
      isTracking: true,
    });
  });

  it("renames options and propagates category, account, and income references", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "options-rename-user");
    const client = asUser(t, user);
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Food",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: "Dinner",
      parentValue: "Food",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "account",
      value: "Checking",
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

    const expenseId = await client.mutation(
      testApi.expenses.create,
      expenseInput("rename-expense", {
        category: "Food",
        subcategory: "Dinner",
        account: "Checking",
      }),
    );
    const incomingId = await client.mutation(
      testApi.incomings.create,
      incomingInput("rename-incoming", {
        incomeType: "Work",
        incomeSubtype: "Salary",
        account: "Checking",
      }),
    );
    const recurringExpenseId = await client.mutation(
      testApi.recurrings.create,
      {
        ...recurringExpenseInput("rename-recurring-expense"),
        recurringExpenseAccount: "Checking",
        recurringExpenseCategory: "Food",
        recurringExpenseSubcategory: "Dinner",
      },
    );
    const recurringIncomingId = await client.mutation(
      testApi.recurrings.create,
      {
        ...recurringIncomingInput("rename-recurring-incoming"),
        recurringIncomingAccount: "Checking",
        recurringIncomingType: "Work",
        recurringIncomingSubtype: "Salary",
      },
    );

    await client.mutation(testApi.userOptions.rename, {
      kind: "category",
      value: "Food",
      nextValue: "Meals",
    });
    await client.mutation(testApi.userOptions.rename, {
      kind: "subcategory",
      value: "Dinner",
      nextValue: "Dining",
      parentValue: "Meals",
    });
    await client.mutation(testApi.userOptions.rename, {
      kind: "account",
      value: "Checking",
      nextValue: "Everyday",
    });
    await client.mutation(testApi.userOptions.rename, {
      kind: "incomeType",
      value: "Work",
      nextValue: "Employment",
    });
    await client.mutation(testApi.userOptions.rename, {
      kind: "incomeSubtype",
      value: "Salary",
      nextValue: "Wages",
      parentValue: "Employment",
    });

    const expenses = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const incomings = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const recurrings = await client.query(testApi.recurrings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(expenses.page.find((row) => row._id === expenseId)).toMatchObject({
      category: "Meals",
      subcategory: "Dining",
      account: "Everyday",
    });
    expect(incomings.page.find((row) => row._id === incomingId)).toMatchObject({
      incomeType: "Employment",
      incomeSubtype: "Wages",
      account: "Everyday",
    });
    expect(
      recurrings.page.find((row) => row._id === recurringExpenseId),
    ).toMatchObject({
      recurringExpenseCategory: "Meals",
      recurringExpenseSubcategory: "Dining",
      recurringExpenseAccount: "Everyday",
    });
    expect(
      recurrings.page.find((row) => row._id === recurringIncomingId),
    ).toMatchObject({
      recurringIncomingType: "Employment",
      recurringIncomingSubtype: "Wages",
      recurringIncomingAccount: "Everyday",
    });

    await expect(
      client.mutation(testApi.userOptions.rename, {
        kind: "category",
        value: "Meals",
        nextValue: "Meals",
      }),
    ).resolves.toBeNull();
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Existing",
    });
    await expect(
      client.mutation(testApi.userOptions.rename, {
        kind: "category",
        value: "Meals",
        nextValue: "Existing",
      }),
    ).rejects.toThrow("already exists");
  });

  it("moves a top-level category into a subtype and migrates dependent records", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "options-move-top-user");
    const client = asUser(t, user);
    for (const value of ["Source", "Target"]) {
      await client.mutation(testApi.userOptions.add, {
        kind: "category",
        value,
      });
    }
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: "Child",
      parentValue: "Source",
    });
    const sourceExpense = await client.mutation(
      testApi.expenses.create,
      expenseInput("source-expense", {
        category: "Source",
        subcategory: "",
      }),
    );
    const childExpense = await client.mutation(
      testApi.expenses.create,
      expenseInput("child-expense", {
        category: "Source",
        subcategory: "Child",
      }),
    );

    await client.mutation(testApi.userOptions.moveToSubtype, {
      kind: "category",
      sourceValue: "Source",
      targetValue: "Target",
    });
    const options = await client.query(testApi.userOptions.list, {});
    expect(optionByValue(options.category, "Source")).toBeUndefined();
    expect(
      optionByValue(options.subcategory, "Source", "Target"),
    ).toMatchObject({
      parentValue: "Target",
    });
    expect(optionByValue(options.subcategory, "Child", "Target")).toMatchObject(
      {
        parentValue: "Target",
      },
    );
    const expenses = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(
      expenses.page.find((row) => row._id === sourceExpense),
    ).toMatchObject({
      category: "Target",
      subcategory: "Source",
    });
    expect(expenses.page.find((row) => row._id === childExpense)).toMatchObject(
      {
        category: "Target",
        subcategory: "Child",
      },
    );
  });

  it("promotes subtypes and moves them between parents without cross-user mutation", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "options-hierarchy-user");
    const other = await createUser(t, "options-hierarchy-other");
    const client = asUser(t, user);
    const otherClient = asUser(t, other);
    for (const value of ["A", "B"]) {
      await client.mutation(testApi.userOptions.add, {
        kind: "category",
        value,
      });
    }
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: "Side",
      parentValue: "A",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: "Promoted",
      parentValue: "A",
    });
    const expenseId = await client.mutation(
      testApi.expenses.create,
      expenseInput("hierarchy-expense", {
        category: "A",
        subcategory: "Side",
      }),
    );
    await client.mutation(testApi.userOptions.moveSubtype, {
      kind: "subcategory",
      value: "Side",
      sourceParentValue: "A",
      targetParentValue: "B",
    });
    await client.mutation(testApi.userOptions.promoteSubtype, {
      kind: "subcategory",
      value: "Promoted",
      parentValue: "A",
    });

    const options = await client.query(testApi.userOptions.list, {});
    expect(optionByValue(options.subcategory, "Side", "B")).toBeDefined();
    expect(optionByValue(options.category, "Promoted")).toBeDefined();
    const expenses = await client.query(testApi.expenses.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(expenses.page.find((row) => row._id === expenseId)).toMatchObject({
      category: "B",
      subcategory: "Side",
    });

    await otherClient.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Private",
    });
    await expect(
      client.mutation(testApi.userOptions.remove, {
        kind: "category",
        value: "Private",
      }),
    ).resolves.toBeNull();
    expect(
      (await otherClient.query(testApi.userOptions.list, {})).category,
    ).toHaveLength(1);
  });

  it("removes category and income-type children with their parent", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "options-remove-user");
    const client = asUser(t, user);
    await client.mutation(testApi.userOptions.add, {
      kind: "category",
      value: "Parent",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "subcategory",
      value: "Child",
      parentValue: "Parent",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "incomeType",
      value: "Type",
    });
    await client.mutation(testApi.userOptions.add, {
      kind: "incomeSubtype",
      value: "Subtype",
      parentValue: "Type",
    });
    await client.mutation(testApi.userOptions.remove, {
      kind: "category",
      value: "Parent",
    });
    await client.mutation(testApi.userOptions.remove, {
      kind: "incomeType",
      value: "Type",
    });
    const options = await client.query(testApi.userOptions.list, {});
    expect(options.category).toEqual([]);
    expect(options.subcategory).toEqual([]);
    expect(options.incomeType).toEqual([]);
    expect(options.incomeSubtype).toEqual([]);
  });
});