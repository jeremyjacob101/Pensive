// @vitest-environment jsdom
import type { SavingsBank, SavingsEntry } from "@pensive/web/types/savings";
import { buildSavingsSeries, calculateForecastBalance, convertSavingsAmount, currentSavingsTotal, latestEntriesByBank, requiresSavingsExchangeRate } from "@pensive/web/helpers/savings";
import { describe, expect, it } from "vitest";

function bank(id: string, overrides: Partial<SavingsBank> = {}): SavingsBank {
  return {
    _id: id,
    _creationTime: 1,
    userId: "savings-user",
    name: id,
    color: "#4389FF",
    currency: "ILS",
    interestEnabled: false,
    annualInterestRate: 0,
    compounding: "monthly",
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as SavingsBank;
}

function entry(
  id: string,
  bankId: string,
  date: string,
  amount: number,
  overrides: Partial<SavingsEntry> = {},
): SavingsEntry {
  return {
    _id: id,
    _creationTime: 1,
    userId: "savings-user",
    bankId,
    date,
    amount,
    currency: "ILS",
    note: undefined,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as SavingsEntry;
}

describe("savings calculations", () => {
  it("converts mixed currencies and blocks unusable rates", () => {
    expect(convertSavingsAmount(100, "ILS", "ILS", null)).toBe(100);
    expect(convertSavingsAmount(100, "USD", "ILS", 3.5)).toBe(350);
    expect(convertSavingsAmount(350, "ILS", "USD", 3.5)).toBe(100);
    expect(convertSavingsAmount(100, "USD", "ILS", null)).toBeNull();
    expect(convertSavingsAmount(100, "USD", "ILS", 0)).toBeNull();
    expect(convertSavingsAmount(100, "USD", "ILS", Number.NaN)).toBeNull();
  });

  it("matches monthly and yearly compound interest math", () => {
    expect(calculateForecastBalance(1_000, 12, "monthly", 1)).toBeCloseTo(
      1_126.83,
      2,
    );
    expect(calculateForecastBalance(1_000, 12, "yearly", 2)).toBeCloseTo(
      1_254.4,
      2,
    );
    expect(calculateForecastBalance(1_000, 0, "monthly", 10)).toBe(1_000);
  });

  it("selects the latest relevant snapshot with deterministic tie-breaking", () => {
    const checking = bank("checking");
    const ignored = bank("ignored");
    const snapshots = [
      entry("old", checking._id, "2026-01-01", 100),
      entry("same-date-first", checking._id, "2026-02-01", 200, {
        createdAt: 10,
        _creationTime: 2,
      }),
      entry("same-date-last", checking._id, "2026-02-01", 300, {
        createdAt: 10,
        _creationTime: 3,
      }),
      entry("future", checking._id, "2026-12-01", 900),
      entry("unrelated", ignored._id, "2026-02-01", 500),
    ];

    const latest = latestEntriesByBank([checking], snapshots, "2026-03-01");
    expect(latest.get(checking._id)?._id).toBe("same-date-last");
    expect(latest.has(ignored._id)).toBe(false);
  });

  it("does not require conversion for an older or future currency snapshot", () => {
    const checking = bank("checking");
    const entries = [
      entry("old-usd", checking._id, "2026-01-01", 100, {
        currency: "USD",
      }),
      entry("current-ils", checking._id, "2026-03-01", 350),
      entry("future-usd", checking._id, "2026-12-01", 200, {
        currency: "USD",
      }),
    ];

    const latest = latestEntriesByBank([checking], entries, "2026-04-01");
    expect(latest.get(checking._id)?.currency).toBe("ILS");
    expect(
      requiresSavingsExchangeRate(
        [checking],
        entries,
        new Set([checking._id]),
        "ILS",
        "2026-04-01",
      ),
    ).toBe(false);

    expect(
      requiresSavingsExchangeRate(
        [checking],
        [
          entry("current-usd", checking._id, "2026-03-01", 100, {
            currency: "USD",
          }),
        ],
        new Set([checking._id]),
        "ILS",
        "2026-04-01",
      ),
    ).toBe(true);
  });

  it("keeps current and forecast totals when only history needs conversion", () => {
    const checking = bank("checking");
    const entries = [
      entry("old-usd", checking._id, "2026-01-01", 100, {
        currency: "USD",
      }),
      entry("current-ils", checking._id, "2026-03-01", 350),
    ];

    const series = buildSavingsSeries({
      banks: [checking],
      entries,
      selectedBankIds: new Set([checking._id]),
      horizonYears: 1,
      interestOn: false,
      displayCurrency: "ILS",
      usdIlsRate: null,
      today: "2026-04-01",
    });

    expect(series.at(-13)).toMatchObject({
      date: "2026-04-01",
      isForecast: false,
      total: 350,
    });
    expect(series.at(-1)?.total).toBe(350);
  });

  it("builds horizons, ignores future-only currency mismatches, and blocks relevant missing rates", () => {
    const ilsBank = bank("ils", {
      interestEnabled: true,
      annualInterestRate: 12,
      compounding: "yearly",
    });
    const usdBank = bank("usd", { currency: "USD" });
    const banks = [ilsBank, usdBank];
    const historical = [
      entry("ils-today", ilsBank._id, "2026-01-01", 1_000),
      entry("usd-future", usdBank._id, "2026-12-01", 100, {
        currency: "USD",
      }),
    ];
    const selected = new Set([ilsBank._id]);

    const oneYear = buildSavingsSeries({
      banks,
      entries: historical,
      selectedBankIds: selected,
      horizonYears: 1,
      interestOn: true,
      displayCurrency: "ILS",
      usdIlsRate: null,
      today: "2026-01-01",
    });
    expect(oneYear).toHaveLength(13);
    expect(oneYear[0]).toMatchObject({ date: "2026-01-01", total: 1_000 });
    expect(oneYear.at(-1)?.total).toBeCloseTo(1_120, 0);

    const mixedWithoutRate = buildSavingsSeries({
      banks,
      entries: [
        ...historical,
        entry("usd-today", usdBank._id, "2026-01-01", 100, {
          currency: "USD",
        }),
      ],
      selectedBankIds: new Set([ilsBank._id, usdBank._id]),
      horizonYears: 1,
      interestOn: false,
      displayCurrency: "ILS",
      usdIlsRate: null,
      today: "2026-01-01",
    });
    expect(mixedWithoutRate).toEqual([]);

    const mixedWithRate = buildSavingsSeries({
      banks,
      entries: [
        entry("ils-today", ilsBank._id, "2026-01-01", 1_000),
        entry("usd-today", usdBank._id, "2026-01-01", 100, {
          currency: "USD",
        }),
      ],
      selectedBankIds: new Set([ilsBank._id, usdBank._id]),
      horizonYears: 2,
      interestOn: false,
      displayCurrency: "ILS",
      usdIlsRate: 3.5,
      today: "2026-01-01",
    });
    expect(mixedWithRate.at(-1)?.total).toBe(1_350);
    expect(mixedWithRate.filter((point) => point.isForecast)).toHaveLength(24);
  });

  it("returns null instead of silently treating an unconvertible current total as zero", () => {
    const usdBank = bank("usd", { currency: "USD" });
    const total = currentSavingsTotal(
      [usdBank],
      [entry("usd-entry", usdBank._id, "2026-01-01", 100, { currency: "USD" })],
      new Set([usdBank._id]),
      "ILS",
      null,
    );
    expect(total).toBeNull();
  });
});
