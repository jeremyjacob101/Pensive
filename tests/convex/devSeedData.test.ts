import { generateSeedData } from "../../convex/devSeedData";
import { describe, expect, it } from "vitest";

describe("development seed data generator", () => {
  it("is deterministic for the same seed and endpoint", () => {
    const first = generateSeedData({
      profile: "realistic",
      seed: 2468,
      asOfDate: "2026-08-18",
    });
    const second = generateSeedData({
      profile: "realistic",
      seed: 2468,
      asOfDate: "2026-08-18",
    });

    expect({
      counts: [
        first.expenses.length,
        first.incomings.length,
        first.paybackLinks.length,
        first.options.length,
        first.savingsEntries.length,
      ],
      expenseIds: first.expenses.slice(0, 5).map((row) => row.expenseId),
      incomingIds: first.incomings.slice(0, 5).map((row) => row.incomingId),
      lastExpense: first.expenses.at(-1)?.expenseId,
    }).toEqual({
      counts: [
        second.expenses.length,
        second.incomings.length,
        second.paybackLinks.length,
        second.options.length,
        second.savingsEntries.length,
      ],
      expenseIds: second.expenses.slice(0, 5).map((row) => row.expenseId),
      incomingIds: second.incomings.slice(0, 5).map((row) => row.incomingId),
      lastExpense: second.expenses.at(-1)?.expenseId,
    });
  });

  it("covers the household finance scenarios used by the app", () => {
    const data = generateSeedData({
      profile: "realistic",
      seed: 20260818,
      asOfDate: "2026-08-18",
    });

    expect(data.expenses.length).toBeGreaterThan(5_000);
    expect(data.incomings.length).toBeGreaterThan(400);
    expect(data.paybackLinks.length).toBeGreaterThan(200);
    expect(data.expenses.some((row) => row.amount >= 4_000)).toBe(true);
    expect(data.expenses.some((row) => (row.monthYears?.length ?? 0) > 1)).toBe(
      true,
    );
    expect(data.expenses.some((row) => row.baseExpenseId !== undefined)).toBe(
      true,
    );
    expect(data.incomings.some((row) => row.baseIncomingId !== undefined)).toBe(
      true,
    );
    expect(data.incomings.some((row) => row.incomeType === "Paid Back")).toBe(
      true,
    );
    expect(
      data.expenses.some(
        (row) =>
          row.effectiveAmountMode === "manual" && row.effectiveAmount === 0,
      ),
    ).toBe(true);
    expect(
      data.incomings.some(
        (row) =>
          row.effectiveAmountMode === "manual" && row.effectiveAmount === 0,
      ),
    ).toBe(true);

    const expenseByKey = new Map(data.expenses.map((row) => [row.key, row]));
    const incomingByKey = new Map(data.incomings.map((row) => [row.key, row]));
    const allocatedByExpense = new Map<string, number>();
    const allocatedByIncoming = new Map<string, number>();
    for (const link of data.paybackLinks) {
      expect(expenseByKey.has(link.expenseKey)).toBe(true);
      expect(incomingByKey.has(link.incomingKey)).toBe(true);
      allocatedByExpense.set(
        link.expenseKey,
        (allocatedByExpense.get(link.expenseKey) ?? 0) + link.allocatedAmount,
      );
      allocatedByIncoming.set(
        link.incomingKey,
        (allocatedByIncoming.get(link.incomingKey) ?? 0) + link.allocatedAmount,
      );
    }
    for (const [key, allocated] of allocatedByExpense) {
      expect(allocated).toBeLessThanOrEqual(expenseByKey.get(key)!.amount);
    }
    for (const [key, allocated] of allocatedByIncoming) {
      expect(allocated).toBeLessThanOrEqual(incomingByKey.get(key)!.amount);
    }

    expect(new Set(data.options.map((row) => row.kind))).toEqual(
      new Set([
        "account",
        "category",
        "subcategory",
        "incomeType",
        "incomeSubtype",
      ]),
    );
    expect(data.savingsBanks).toHaveLength(4);
    expect(data.savingsEntries.length).toBeGreaterThan(20);
    expect(data.notes.length).toBeGreaterThan(5);
    expect(data.tables.length).toBeGreaterThan(2);
  });
});