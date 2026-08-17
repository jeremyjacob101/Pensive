import type { ProjectionBank, ProjectionBankId, ProjectionChartPoint, ProjectionCurrency, ProjectionEntry } from "../types/projections";

const DAY_MS = 86_400_000;
const PROJECTION_MONEY_FORMATTERS: Record<
  ProjectionCurrency,
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
  ProjectionCurrency,
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

export function formatProjectionDate(value: string, includeYear = true) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
  }).format(parseIsoDate(value));
}

export function resolvedProjectionCurrency(value?: string): ProjectionCurrency {
  return value === "USD" ? "USD" : "ILS";
}

export function otherProjectionCurrency(
  currency: ProjectionCurrency,
): ProjectionCurrency {
  return currency === "ILS" ? "USD" : "ILS";
}

export function projectionCurrencySymbol(currency: ProjectionCurrency) {
  return currency === "ILS" ? "₪" : "$";
}

export function formatProjectionMoney(
  value: number,
  currency: ProjectionCurrency,
  cents = false,
) {
  return PROJECTION_MONEY_FORMATTERS[currency][
    cents ? "cents" : "whole"
  ].format(value);
}

export function convertProjectionAmount(
  amount: number,
  from: ProjectionCurrency,
  to: ProjectionCurrency,
  usdIlsRate: number | null | undefined,
): number | null {
  if (from === to) return amount;
  if (!usdIlsRate || !Number.isFinite(usdIlsRate) || usdIlsRate <= 0) {
    return null;
  }
  return from === "USD" ? amount * usdIlsRate : amount / usdIlsRate;
}

export function isUsableProjectionRate(
  rate: number | null | undefined,
): rate is number {
  return (
    rate !== null && rate !== undefined && Number.isFinite(rate) && rate > 0
  );
}

export function latestEntriesByBank(
  banks: ProjectionBank[],
  entries: ProjectionEntry[],
  asOf = localIsoDate(),
) {
  const result = new Map<ProjectionBankId, ProjectionEntry>();
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

export function calculateProjectedBalance(
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

export function buildProjectionSeries({ banks, entries, selectedBankIds, horizonYears, interestOn, displayCurrency, usdIlsRate, today = localIsoDate() }: {
  banks: ProjectionBank[];
  entries: ProjectionEntry[];
  selectedBankIds: Set<ProjectionBankId>;
  horizonYears: number;
  interestOn: boolean;
  displayCurrency: ProjectionCurrency;
  usdIlsRate: number | null;
  today?: string;
}): ProjectionChartPoint[] {
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
  const requiresRate = selectedEntries.some(
    (entry) => resolvedProjectionCurrency(entry.currency) !== displayCurrency,
  );
  if (requiresRate && !isUsableProjectionRate(usdIlsRate)) return [];
  const dates = [
    ...new Set([...selectedEntries.map((entry) => entry.date), today]),
  ].toSorted();
  const latest = new Map<ProjectionBankId, ProjectionEntry>();
  const historical: ProjectionChartPoint[] = [];

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
    for (const bank of selectedBanks) {
      const entry = latest.get(bank._id);
      const amount = entry
        ? (convertProjectionAmount(
            entry.amount,
            resolvedProjectionCurrency(entry.currency),
            displayCurrency,
            usdIlsRate,
          ) ?? 0)
        : 0;
      values[bank._id] = amount;
      total += amount;
    }
    historical.push({
      date,
      timestamp: parseIsoDate(date).getTime(),
      isProjected: false,
      total,
      values,
    });
  }

  const currentByBank = latestEntriesByBank(
    selectedBanks,
    selectedEntries,
    today,
  );
  const anchor = parseIsoDate(today);
  const projection: ProjectionChartPoint[] = [];
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
        ? (convertProjectionAmount(
            entry.amount,
            resolvedProjectionCurrency(entry.currency),
            displayCurrency,
            usdIlsRate,
          ) ?? 0)
        : 0;
      const value =
        interestOn && bank.interestEnabled
          ? calculateProjectedBalance(
              principal,
              bank.annualInterestRate,
              bank.compounding,
              elapsedYears,
            )
          : principal;
      values[bank._id] = value;
      total += value;
    }
    projection.push({
      date: iso,
      timestamp: date.getTime(),
      isProjected: true,
      total,
      values,
    });
  }

  return [...historical, ...projection];
}

export function currentProjectionTotal(
  banks: ProjectionBank[],
  entries: ProjectionEntry[],
  selectedBankIds: Set<ProjectionBankId>,
  displayCurrency: ProjectionCurrency,
  usdIlsRate: number | null,
) {
  const selected = banks.filter((bank) => selectedBankIds.has(bank._id));
  const latest = latestEntriesByBank(selected, entries);
  let total = 0;
  for (const bank of selected) {
    const entry = latest.get(bank._id);
    if (!entry) continue;
    const converted = convertProjectionAmount(
      entry.amount,
      resolvedProjectionCurrency(entry.currency),
      displayCurrency,
      usdIlsRate,
    );
    if (converted === null) return null;
    total += converted;
  }
  return total;
}