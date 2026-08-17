import type { SavingsBank, SavingsBankId, SavingsChartPoint, SavingsCurrency, SavingsEntry } from "../types/savings";

const DAY_MS = 86_400_000;
const SAVINGS_MONEY_FORMATTERS: Record<
  SavingsCurrency,
  { whole: Intl.NumberFormat; cents: Intl.NumberFormat }
> = Object.fromEntries(
  (["ILS", "USD"] as const).map((currency) => [
    currency,
    {
      whole: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 0,
      }),
      cents: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
  ]),
) as Record<
  SavingsCurrency,
  { whole: Intl.NumberFormat; cents: Intl.NumberFormat }
>;

export function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function formatSavingsDate(value: string, includeYear = true) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(parseIsoDate(value));
}

export function resolvedSavingsCurrency(value?: string): SavingsCurrency {
  return value === "USD" ? "USD" : "ILS";
}

export function otherSavingsCurrency(
  currency: SavingsCurrency,
): SavingsCurrency {
  return currency === "ILS" ? "USD" : "ILS";
}

export function savingsCurrencySymbol(currency: SavingsCurrency) {
  return currency === "ILS" ? "₪" : "$";
}

export function formatSavingsMoney(
  value: number,
  currency: SavingsCurrency,
  cents = false,
) {
  return SAVINGS_MONEY_FORMATTERS[currency][cents ? "cents" : "whole"].format(
    value,
  );
}

export function convertSavingsAmount(
  amount: number,
  from: SavingsCurrency,
  to: SavingsCurrency,
  usdIlsRate: number | null | undefined,
): number | null {
  if (from === to) return amount;
  if (!usdIlsRate || !Number.isFinite(usdIlsRate) || usdIlsRate <= 0) {
    return null;
  }
  return from === "USD" ? amount * usdIlsRate : amount / usdIlsRate;
}

export function isUsableSavingsRate(
  rate: number | null | undefined,
): rate is number {
  return (
    rate !== null && rate !== undefined && Number.isFinite(rate) && rate > 0
  );
}

export function latestEntriesByBank(
  banks: SavingsBank[],
  entries: SavingsEntry[],
  asOf = localIsoDate(),
) {
  const result = new Map<SavingsBankId, SavingsEntry>();
  const validBankIds = new Set(banks.map((bank) => bank._id));
  for (const entry of entries) {
    if (!validBankIds.has(entry.bankId) || entry.date > asOf) continue;
    const current = result.get(entry.bankId);
    if (
      !current ||
      entry.date > current.date ||
      (entry.date === current.date &&
        (entry.createdAt > current.createdAt ||
          (entry.createdAt === current.createdAt &&
            entry._creationTime > current._creationTime)))
    ) {
      result.set(entry.bankId, entry);
    }
  }
  return result;
}

export function requiresSavingsExchangeRate(
  banks: SavingsBank[],
  entries: SavingsEntry[],
  selectedBankIds: Set<SavingsBankId>,
  displayCurrency: SavingsCurrency,
  asOf = localIsoDate(),
) {
  const selectedBanks = banks.filter((bank) => selectedBankIds.has(bank._id));
  return [...latestEntriesByBank(selectedBanks, entries, asOf).values()].some(
    (entry) => resolvedSavingsCurrency(entry.currency) !== displayCurrency,
  );
}

export function calculateForecastBalance(
  principal: number,
  annualRate: number,
  compounding: "monthly" | "yearly",
  years: number,
) {
  if (annualRate <= 0 || years <= 0) return principal;
  const periods = compounding === "monthly" ? 12 : 1;
  return principal * (1 + annualRate / 100 / periods) ** (periods * years);
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(targetDay, lastDay));
  return result;
}

function yearsBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (365.2425 * DAY_MS));
}

export function buildSavingsSeries({ banks, entries, selectedBankIds, horizonYears, interestOn, displayCurrency, usdIlsRate, today = localIsoDate() }: {
  banks: SavingsBank[];
  entries: SavingsEntry[];
  selectedBankIds: Set<SavingsBankId>;
  horizonYears: number;
  interestOn: boolean;
  displayCurrency: SavingsCurrency;
  usdIlsRate: number | null;
  today?: string;
}): SavingsChartPoint[] {
  const selectedBanks = banks.filter((bank) => selectedBankIds.has(bank._id));
  if (selectedBanks.length === 0) return [];

  const selectedIds = new Set(selectedBanks.map((bank) => bank._id));
  const selectedEntries = entries
    .filter((entry) => selectedIds.has(entry.bankId) && entry.date <= today)
    .toSorted(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt - b.createdAt ||
        a._creationTime - b._creationTime,
    );
  const currentByBank = latestEntriesByBank(
    selectedBanks,
    selectedEntries,
    today,
  );
  const currentRequiresRate = [...currentByBank.values()].some(
    (entry) => resolvedSavingsCurrency(entry.currency) !== displayCurrency,
  );
  if (currentRequiresRate && !isUsableSavingsRate(usdIlsRate)) return [];
  const dates = [
    ...new Set([...selectedEntries.map((entry) => entry.date), today]),
  ].toSorted();
  const latest = new Map<SavingsBankId, SavingsEntry>();
  const historical: SavingsChartPoint[] = [];

  for (const date of dates) {
    for (const entry of selectedEntries) {
      if (entry.date > date) break;
      const current = latest.get(entry.bankId);
      if (
        !current ||
        entry.date > current.date ||
        (entry.date === current.date &&
          (entry.createdAt > current.createdAt ||
            (entry.createdAt === current.createdAt &&
              entry._creationTime > current._creationTime)))
      ) {
        latest.set(entry.bankId, entry);
      }
    }
    const values: Record<string, number> = {};
    let total = 0;
    let canRender = true;
    for (const bank of selectedBanks) {
      const entry = latest.get(bank._id);
      if (!entry) {
        values[bank._id] = 0;
        continue;
      }
      const amount = convertSavingsAmount(
        entry.amount,
        resolvedSavingsCurrency(entry.currency),
        displayCurrency,
        usdIlsRate,
      );
      if (amount === null) {
        canRender = false;
        break;
      }
      values[bank._id] = amount;
      total += amount;
    }
    if (canRender) {
      historical.push({
        date,
        timestamp: parseIsoDate(date).getTime(),
        isForecast: false,
        total,
        values,
      });
    }
  }

  const anchor = parseIsoDate(today);
  const savings: SavingsChartPoint[] = [];
  const monthCount = Math.max(1, Math.round(horizonYears * 12));
  for (let month = 1; month <= monthCount; month += 1) {
    const date = addMonths(anchor, month);
    const iso = localIsoDate(date);
    const elapsedYears = yearsBetween(anchor, date);
    const values: Record<string, number> = {};
    let total = 0;
    for (const bank of selectedBanks) {
      const entry = currentByBank.get(bank._id);
      const principal = entry
        ? convertSavingsAmount(
            entry.amount,
            resolvedSavingsCurrency(entry.currency),
            displayCurrency,
            usdIlsRate,
          )
        : 0;
      if (principal === null) return [];
      const value =
        interestOn && bank.interestEnabled
          ? calculateForecastBalance(
              principal,
              bank.annualInterestRate,
              bank.compounding,
              elapsedYears,
            )
          : principal;
      values[bank._id] = value;
      total += value;
    }
    savings.push({
      date: iso,
      timestamp: date.getTime(),
      isForecast: true,
      total,
      values,
    });
  }

  return [...historical, ...savings];
}

export function currentSavingsTotal(
  banks: SavingsBank[],
  entries: SavingsEntry[],
  selectedBankIds: Set<SavingsBankId>,
  displayCurrency: SavingsCurrency,
  usdIlsRate: number | null,
) {
  const selected = banks.filter((bank) => selectedBankIds.has(bank._id));
  const latest = latestEntriesByBank(selected, entries);
  let total = 0;
  for (const bank of selected) {
    const entry = latest.get(bank._id);
    if (!entry) continue;
    const converted = convertSavingsAmount(
      entry.amount,
      resolvedSavingsCurrency(entry.currency),
      displayCurrency,
      usdIlsRate,
    );
    if (converted === null) return null;
    total += converted;
  }
  return total;
}