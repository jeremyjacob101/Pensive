export const ORIGINAL_CURRENCY = "ILS" as const;

export type OriginalCurrency = typeof ORIGINAL_CURRENCY;

export type LedgerAmountFields = {
  amount?: number;
  originalAmount?: number;
  originalCurrency?: OriginalCurrency;
};

export function getOriginalAmount(row: LedgerAmountFields) {
  const amount = row.originalAmount ?? row.amount;
  if (amount === undefined) {
    throw new Error("Ledger row is missing an amount");
  }
  return amount;
}

export function getOriginalCurrency(row: LedgerAmountFields) {
  return row.originalCurrency ?? ORIGINAL_CURRENCY;
}

export function dualWriteLedgerAmountFields(args: {
  amount: number;
  originalAmount?: number;
  originalCurrency?: OriginalCurrency;
}) {
  const originalAmount = args.originalAmount ?? args.amount;
  return {
    amount: originalAmount,
    originalAmount,
    originalCurrency: args.originalCurrency ?? ORIGINAL_CURRENCY,
  };
}

export function withLedgerAmountFields<T extends LedgerAmountFields>(row: T) {
  const originalAmount = getOriginalAmount(row);
  return {
    ...row,
    amount: originalAmount,
    originalAmount,
    originalCurrency: getOriginalCurrency(row),
  };
}

export function canonicalLedgerAmountFields(args: {
  amount?: number;
  originalAmount?: number;
  originalCurrency?: OriginalCurrency;
}) {
  const originalAmount = getOriginalAmount(args);
  return {
    originalAmount,
    originalCurrency: args.originalCurrency ?? ORIGINAL_CURRENCY,
  };
}
