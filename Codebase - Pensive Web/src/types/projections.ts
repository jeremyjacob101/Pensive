import type { Doc, Id } from "@pensive/convex-data-model";

export type ProjectionBank = Doc<"projectionBanks">;
export type ProjectionEntry = Doc<"projectionEntries">;
export type ProjectionBankId = Id<"projectionBanks">;
export type ProjectionEntryId = Id<"projectionEntries">;
export type ProjectionCurrency = "ILS" | "USD";

export type ProjectionCurrencySettings = {
  displayCurrency: ProjectionCurrency;
  manualUsdIlsRate: number | null;
  liveUsdIlsRate: number | null;
  liveRateDate: string | null;
  liveRateFetchedAt: number | null;
  rateSource: string;
};

export type ProjectionChartMode = "stacked" | "lines" | "total";
export type ProjectionHorizon = 1 | 3 | 5 | 10 | 15 | 20 | 25 | 30 | 40 | 50;

export type ProjectionChartPoint = {
  date: string;
  timestamp: number;
  isProjected: boolean;
  total: number;
  values: Record<string, number>;
};

export type ProjectionBankDraft = {
  name: string;
  color: string;
  currency: ProjectionCurrency;
  interestEnabled: boolean;
  annualInterestRate: number;
  compounding: "monthly" | "yearly";
  startingBalance?: number;
  startingDate?: string;
  startingNote?: string;
};

export type ProjectionEntryDraft = {
  bankId: ProjectionBankId;
  date: string;
  amount: number;
  currency: ProjectionCurrency;
  note?: string;
};