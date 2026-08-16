import { asUser, createUser, expenseInput, incomingInput, makeConvexTest, testApi } from "./support";
import { describe, expect, it } from "vitest";

describe("Convex incomings", () => {
  it("requires authentication for read and write operations", async () => {
    const t = makeConvexTest();

    await expect(
      t.query(testApi.incomings.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).rejects.toThrow("Unauthenticated");
    await expect(
      t.mutation(testApi.incomings.create, incomingInput("unauthenticated")),
    ).rejects.toThrow("Unauthenticated");
  });

  it("normalizes dates and month ownership while isolating users", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "incoming-alice");
    const bob = await createUser(t, "incoming-bob");
    const aliceClient = asUser(t, alice);
    const bobClient = asUser(t, bob);

    const id = await aliceClient.mutation(
      testApi.incomings.create,
      incomingInput("incoming-a", {
        date: "1/9/2025",
        monthYears: ["2025-02", "2025-01", "2025-02", "invalid"],
        effectiveAmount: 75,
        effectiveAmountMode: "manual",
      }),
    );

    const rows = await aliceClient.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page).toHaveLength(1);
    expect(rows.page[0]).toMatchObject({
      _id: id,
      date: "2025-01-09",
      monthYears: ["2025-01", "2025-02"],
      effectiveAmount: 75,
      effectiveAmountMode: "manual",
    });

    expect(
      await bobClient.query(testApi.incomings.list, {
        paginationOpts: { cursor: null, numItems: 10 },
      }),
    ).toMatchObject({ page: [] });

    await expect(
      bobClient.mutation(testApi.incomings.update, {
        ...incomingInput("cross-user-update"),
        id,
      }),
    ).rejects.toThrow("Not found");
  });

  it("supports normalized account lookup and cursor pagination", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "incoming-account-user");
    const client = asUser(t, user);

    await client.mutation(testApi.incomings.bulkCreate, {
      rows: [
        incomingInput("account-jan", {
          account: "Checking",
          date: "2025-01-01",
        }),
        incomingInput("account-feb", {
          account: "  checking  ",
          date: "2025-02-01",
        }),
        incomingInput("other-account", {
          account: "Savings",
          date: "2025-03-01",
        }),
      ],
    });

    const first = await client.query(testApi.incomings.listByAccount, {
      account: " CHECKING ",
      paginationOpts: { cursor: null, numItems: 1 },
    });
    expect(first.page).toHaveLength(1);
    expect(first.page[0].incomingId).toBe("account-feb");
    expect(first.continueCursor).toBe("normalized:1");

    const second = await client.query(testApi.incomings.listByAccount, {
      account: "CHECKING",
      paginationOpts: { cursor: first.continueCursor, numItems: 1 },
    });
    expect(second.page.map((row) => row.incomingId)).toEqual(["account-jan"]);
    expect(second.isDone).toBe(true);
    expect(second.continueCursor).toBeNull();
  });

  it("scopes by date, includes month overlap, and exposes month bounds", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "incoming-scope-user");
    const client = asUser(t, user);

    await client.mutation(testApi.incomings.bulkCreate, {
      rows: [
        incomingInput("scope-jan", {
          date: "2025-01-10",
          monthYears: ["2025-01"],
        }),
        incomingInput("scope-overlap", {
          date: "2024-12-31",
          monthYears: ["2025-01"],
        }),
        incomingInput("scope-feb", {
          date: "2025-02-10",
          monthYears: ["2025-02"],
        }),
      ],
    });

    const withoutOverlap = await client.query(
      testApi.incomings.listByDateScope,
      {
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        targetMonths: ["2025-01"],
        includeMonthYearOverlapOutsideDate: false,
      },
    );
    expect(withoutOverlap.map((row) => row.incomingId)).toEqual(["scope-jan"]);

    const withOverlap = await client.query(testApi.incomings.listByDateScope, {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      targetMonths: ["2025-01"],
      includeMonthYearOverlapOutsideDate: true,
    });
    expect(withOverlap.map((row) => row.incomingId)).toEqual([
      "scope-jan",
      "scope-overlap",
    ]);

    expect(await client.query(testApi.incomings.monthBounds, {})).toEqual({
      newestMonth: "2025-02",
      oldestMonth: "2024-12",
    });
    expect(
      await client.query(testApi.incomings.previousMonthBefore, {
        month: "2025-02",
      }),
    ).toBe("2025-01");
    expect(
      await client.query(testApi.incomings.previousMonthBefore, {
        month: "bad",
      }),
    ).toBeNull();
  });

  it("patches visible rows, preserves manual amounts, and deletes payback links", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "incoming-patch-user");
    const otherUser = await createUser(t, "incoming-patch-other");
    const client = asUser(t, user);
    const otherClient = asUser(t, otherUser);
    const expenseId = await client.mutation(
      testApi.expenses.create,
      expenseInput("incoming-linked-expense"),
    );
    const incomingId = await client.mutation(
      testApi.incomings.create,
      incomingInput("incoming-patch", { amount: 200 }),
    );
    const otherIncomingId = await otherClient.mutation(
      testApi.incomings.create,
      incomingInput("other-incoming"),
    );
    await client.mutation(testApi.paybackLinks.create, {
      expenseId,
      incomingId,
      allocatedAmount: 25,
    });

    await client.mutation(testApi.incomings.update, {
      ...incomingInput("incoming-patch", { amount: 300 }),
      id: incomingId,
      effectiveAmount: undefined,
      effectiveAmountMode: "auto",
    });
    await client.mutation(testApi.incomings.bulkPatchVisible, {
      ids: [incomingId, incomingId],
      patch: { account: "  Savings ", notes: "  patched ", comments: null },
    });
    const updated = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(updated.page[0]).toMatchObject({
      account: "Savings",
      notes: "patched",
      effectiveAmount: 275,
      effectiveAmountMode: "auto",
    });
    expect(updated.page[0]).not.toHaveProperty("comments");

    await expect(
      client.mutation(testApi.incomings.bulkPatchVisible, {
        ids: [incomingId, otherIncomingId],
        patch: { account: "should not apply" },
      }),
    ).rejects.toThrow("not found");

    const cleared = await client.mutation(testApi.incomings.clearAll, {
      batchSize: 10,
    });
    expect(cleared).toEqual({ deleted: 1, done: true });
    expect(
      await client.query(testApi.paybackLinks.listForExpense, { expenseId }),
    ).toEqual([]);
  });

  it("links partner groups, rejects invalid links, and normalizes sub ids", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "incoming-group-user");
    const client = asUser(t, user);
    const first = await client.mutation(
      testApi.incomings.create,
      incomingInput("partner-a"),
    );
    const second = await client.mutation(
      testApi.incomings.create,
      incomingInput("partner-b"),
    );
    const third = await client.mutation(
      testApi.incomings.create,
      incomingInput("partner-c"),
    );

    await expect(
      client.mutation(testApi.incomings.addPartnerIncoming, {
        anchorIncomingId: first,
        partnerIncomingId: first,
      }),
    ).rejects.toThrow("itself");

    const linked = await client.mutation(testApi.incomings.addPartnerIncoming, {
      anchorIncomingId: first,
      partnerIncomingId: second,
    });
    expect(linked).toMatchObject({ linked: 2, baseIncomingId: "partner-a" });
    await client.mutation(testApi.incomings.addPartnerIncoming, {
      anchorIncomingId: first,
      partnerIncomingId: third,
    });
    let rows = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page.map((row) => row.subIncomingId).sort()).toEqual([
      "001",
      "002",
      "003",
    ]);

    const unlinked = await client.mutation(
      testApi.incomings.unlinkIncomingFromPartners,
      {
        incomingId: second,
      },
    );
    expect(unlinked).toMatchObject({ unlinked: 1, remainingLinked: 2 });
    rows = await client.query(testApi.incomings.list, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(rows.page.find((row) => row._id === second)).not.toHaveProperty(
      "baseIncomingId",
    );
    expect(rows.page.find((row) => row._id === second)).not.toHaveProperty(
      "subIncomingId",
    );
    expect(
      rows.page.filter((row) => row.baseIncomingId === "partner-a"),
    ).toHaveLength(2);
  });
});