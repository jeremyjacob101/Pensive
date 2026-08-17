import type { Doc, Id } from "@pensive/convex-data-model";

export type SavingsBank = Doc<"savingsBanks">;
export type SavingsEntry = Doc<"savingsEntries">;
export type SavingsBankId = Id<"savingsBanks">;
export type SavingsEntryId = Id<"savingsEntries">;
export type SavingsCurrency = "ILS" | "USD";

export type SavingsCurrencySettings = {
  displayCurrency: SavingsCurrency;
  manualUsdIlsRate: number | null;
  liveUsdIlsRate: number | null;
  liveRateDate: string | null;
  liveRateFetchedAt: number | null;
  rateSource: string;
};

export type SavingsChartMode = "stacked" | "lines" | "total";
export type SavingsHorizon = 1 | 3 | 5 | 10 | 15 | 20 | 25 | 30 | 40 | 50;

export type SavingsChartPoint = {
  date: string;
  timestamp: number;
  isForecast: boolean;
  total: number;
  values: Record<string, number>;
};

export type SavingsBankDraft = {
  name: string;
  color: string;
  currency: SavingsCurrency;
  interestEnabled: boolean;
  annualInterestRate: number;
  compounding: "monthly" | "yearly";
  startingBalance?: number;
  startingDate?: string;
  startingNote?: string;
};

export type SavingsEntryDraft = {
  bankId: SavingsBankId;
  date: string;
  amount: number;
  currency: SavingsCurrency;
  note?: string;
};