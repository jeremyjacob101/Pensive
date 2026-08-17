import { asUser, createUser, internalApi, makeConvexTest, testApi } from "./support";
import type { Id } from "../../convex/_generated/dataModel";
import { describe, expect, it } from "vitest";

function bankInput(
  overrides: Partial<{
    name: string;
    color: string;
    interestEnabled: boolean;
    annualInterestRate: number;
    compounding: "monthly" | "yearly";
    currency: "ILS" | "USD";
    startingBalance: number;
    startingDate: string;
    startingNote: string;
  }> = {},
) {
  return {
    name: "Checking",
    color: "#4389FF",
    interestEnabled: true,
    annualInterestRate: 1.5,
    compounding: "monthly" as const,
    currency: "ILS" as const,
    ...overrides,
  };
}

function entryInput(
  bankId: Id<"projectionBanks">,
  overrides: Partial<{
    date: string;
    amount: number;
    currency: "ILS" | "USD";
    note: string;
  }> = {},
) {
  return {
    bankId,
    date: "2026-01-01",
    amount: 100,
    currency: "ILS" as const,
    ...overrides,
  };
}

describe("Convex projections", () => {
  it("requires authentication for projection reads and writes", async () => {
    const t = makeConvexTest();

    await expect(t.query(testApi.projections.list, {})).rejects.toThrow(
      "Unauthenticated",
    );
    await expect(
      t.mutation(testApi.projections.setCurrencySettings, {
        displayCurrency: "ILS",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  it("creates, lists, edits, reorders, and stores currency settings", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "projection-crud");
    const client = asUser(t, user);

    const checking = await client.mutation(
      testApi.projections.createBank,
      bankInput({
        name: " Checking ",
        startingBalance: 1_000,
        startingDate: "2026-01-01",
        startingNote: "opening",
      }),
    );
    const savings = await client.mutation(
      testApi.projections.createBank,
      bankInput({
        name: "Savings",
        color: "#ff6758",
        currency: "USD",
        annualInterestRate: 2,
        startingBalance: 500,
        startingDate: "2026-02-01",
      }),
    );
    const entry = await client.mutation(
      testApi.projections.createEntry,
      entryInput(checking, {
        date: "2026-03-01",
        amount: 1_250,
        note: "updated snapshot",
      }),
    );

    await client.mutation(testApi.projections.updateBank, {
      id: checking,
      name: "Daily checking",
      color: "#153CF8",
      interestEnabled: false,
      annualInterestRate: 0,
      compounding: "yearly",
      currency: "ILS",
    });
    await client.mutation(testApi.projections.updateEntry, {
      id: entry,
      bankId: savings,
      date: "2026-04-01",
      amount: 600,
      currency: "USD",
      note: "moved snapshot",
    });
    await client.mutation(testApi.projections.reorderBanks, {
      ids: [savings, checking],
    });
    await client.mutation(testApi.projections.setCurrencySettings, {
      displayCurrency: "USD",
      manualUsdIlsRate: 3.5,
    });

    const result = await client.query(testApi.projections.list, {});
    expect(result.banks.map((bank) => bank.name)).toEqual([
      "Savings",
      "Daily checking",
    ]);
    expect(result.banks[0]).toMatchObject({
      _id: savings,
      color: "#FF6758",
      currency: "USD",
      sortOrder: 0,
    });
    expect(result.entries).toHaveLength(3);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: entry,
          bankId: savings,
          date: "2026-04-01",
          amount: 600,
          currency: "USD",
          note: "moved snapshot",
        }),
        expect.objectContaining({
          bankId: checking,
          date: "2026-01-01",
          amount: 1_000,
        }),
        expect.objectContaining({
          bankId: savings,
          date: "2026-02-01",
          amount: 500,
        }),
      ]),
    );
    expect(result.settings).toMatchObject({
      displayCurrency: "USD",
      manualUsdIlsRate: 3.5,
      liveUsdIlsRate: null,
    });
  });

  it("isolates users and cascades a bank deletion to its entries", async () => {
    const t = makeConvexTest();
    const alice = await createUser(t, "projection-alice");
    const bob = await createUser(t, "projection-bob");
    const aliceClient = asUser(t, alice);
    const bobClient = asUser(t, bob);
    const aliceBank = await aliceClient.mutation(
      testApi.projections.createBank,
      bankInput({
        name: "Alice bank",
        startingBalance: 10,
        startingDate: "2026-01-01",
      }),
    );
    const bobBank = await bobClient.mutation(
      testApi.projections.createBank,
      bankInput({
        name: "Bob bank",
        startingBalance: 20,
        startingDate: "2026-01-01",
      }),
    );

    await expect(
      aliceClient.mutation(testApi.projections.removeBank, { id: bobBank }),
    ).rejects.toThrow("Projection bank not found");
    await expect(
      aliceClient.mutation(testApi.projections.updateBank, {
        id: bobBank,
        name: "No access",
        color: "#153CF8",
        interestEnabled: false,
        annualInterestRate: 0,
        compounding: "monthly",
        currency: "ILS",
      }),
    ).rejects.toThrow("Projection bank not found");

    await aliceClient.mutation(testApi.projections.removeBank, {
      id: aliceBank,
    });
    const remaining = await t.run(async (ctx) => ({
      aliceBanks: await ctx.db
        .query("projectionBanks")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      aliceEntries: await ctx.db
        .query("projectionEntries")
        .withIndex("by_user_id", (q) => q.eq("userId", alice))
        .collect(),
      bobBanks: await ctx.db
        .query("projectionBanks")
        .withIndex("by_user_id", (q) => q.eq("userId", bob))
        .collect(),
      bobEntries: await ctx.db
        .query("projectionEntries")
        .withIndex("by_user_id", (q) => q.eq("userId", bob))
        .collect(),
    }));
    expect(remaining.aliceBanks).toEqual([]);
    expect(remaining.aliceEntries).toEqual([]);
    expect(remaining.bobBanks).toHaveLength(1);
    expect(remaining.bobBanks[0]._id).toBe(bobBank);
    expect(remaining.bobEntries).toHaveLength(1);
  });

  it("rejects invalid values and incomplete reorder requests", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "projection-validation");
    const client = asUser(t, user);

    await expect(
      client.mutation(testApi.projections.createBank, bankInput({ name: " " })),
    ).rejects.toThrow("Bank name is required");
    await expect(
      client.mutation(
        testApi.projections.createBank,
        bankInput({ color: "blue" }),
      ),
    ).rejects.toThrow("six-digit hex");
    await expect(
      client.mutation(
        testApi.projections.createBank,
        bankInput({ annualInterestRate: 101 }),
      ),
    ).rejects.toThrow("between 0 and 100");
    await expect(
      client.mutation(
        testApi.projections.createBank,
        bankInput({ startingBalance: 10 }),
      ),
    ).rejects.toThrow("Starting balance date is required");
    await expect(
      client.mutation(
        testApi.projections.createBank,
        bankInput({ startingBalance: 10, startingDate: "2026-02-30" }),
      ),
    ).rejects.toThrow("real calendar date");

    const first = await client.mutation(
      testApi.projections.createBank,
      bankInput({ name: "First" }),
    );
    const second = await client.mutation(
      testApi.projections.createBank,
      bankInput({ name: "Second" }),
    );
    await expect(
      client.mutation(testApi.projections.reorderBanks, {
        ids: [first, first],
      }),
    ).rejects.toThrow("duplicates");
    await expect(
      client.mutation(testApi.projections.reorderBanks, { ids: [first] }),
    ).rejects.toThrow("every bank exactly once");
    expect(
      (await client.query(testApi.projections.list, {})).banks,
    ).toHaveLength(2);
    void second;
  });

  it("defaults legacy rows to ILS and keeps the global cache outside account ownership", async () => {
    const t = makeConvexTest();
    const user = await createUser(t, "projection-legacy");
    const client = asUser(t, user);
    const ids = await t.run(async (ctx) => {
      const now = 1_000;
      const bankId = await ctx.db.insert("projectionBanks", {
        userId: user,
        name: "Legacy bank",
        color: "#4389FF",
        interestEnabled: false,
        annualInterestRate: 0,
        compounding: "monthly",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      const entryId = await ctx.db.insert("projectionEntries", {
        userId: user,
        bankId,
        date: "2026-01-01",
        amount: 50,
        createdAt: now,
        updatedAt: now,
      });
      return { bankId, entryId };
    });

    const result = await client.query(testApi.projections.list, {});
    expect(result.settings).toMatchObject({
      displayCurrency: "ILS",
      manualUsdIlsRate: null,
    });
    expect(result.banks[0].currency).toBe("ILS");
    expect(result.entries[0]).toMatchObject({
      _id: ids.entryId,
      currency: "ILS",
    });

    await t.mutation(internalApi.projections.storeExchangeRate, {
      rate: 3.25,
      rateDate: "2026-08-11",
      fetchedAt: 2_000,
    });
    const cached = await t.query(
      internalApi.projections.getCachedExchangeRate,
      {},
    );
    expect(cached).toMatchObject({
      pair: "USD_ILS",
      rate: 3.25,
      rateDate: "2026-08-11",
      source: "Frankfurter",
    });
  });
});