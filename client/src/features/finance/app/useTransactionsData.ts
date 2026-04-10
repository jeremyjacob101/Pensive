import { useEffect, useMemo, useState } from "react";
import { requestJson } from "../../../lib/firebaseApi";
import type { Entry, EntryType } from "../types";

type TransactionSort =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "name-asc";

type TransactionFilters = {
  month: string;
  type: "all" | EntryType;
  account: string;
  category: string;
  entryKind: string;
  search: string;
  minAmount: string;
  maxAmount: string;
  fromDate: string;
  toDate: string;
  sort: TransactionSort;
};

export type BreakdownItem = {
  label: string;
  count: number;
  total: number;
};

const initialFilters: TransactionFilters = {
  month: "all",
  type: "all",
  account: "all",
  category: "all",
  entryKind: "all",
  search: "",
  minAmount: "",
  maxAmount: "",
  fromDate: "",
  toDate: "",
  sort: "date-desc",
};

type UseTransactionsDataOptions = {
  activeUsername: string | null;
  refreshToken: string;
};

function buildBreakdown(
  entries: Entry[],
  getLabel: (entry: Entry) => string,
  limit?: number,
) {
  const breakdownMap = new Map<string, BreakdownItem>();

  entries.forEach((entry) => {
    const label = getLabel(entry);
    const current = breakdownMap.get(label);

    if (current) {
      current.count += 1;
      current.total += entry.amount;
      return;
    }

    breakdownMap.set(label, {
      label,
      count: 1,
      total: entry.amount,
    });
  });

  const items = [...breakdownMap.values()].sort(
    (left, right) =>
      right.total - left.total || right.count - left.count || left.label.localeCompare(right.label),
  );

  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export function useTransactionsData({
  activeUsername,
  refreshToken,
}: UseTransactionsDataOptions) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);

  useEffect(() => {
    if (!activeUsername) {
      setEntries([]);
      setError(null);
      setFilters(initialFilters);
      return;
    }

    const abortController = new AbortController();

    async function loadEntries() {
      setIsLoading(true);
      setError(null);

      try {
        const allEntries = await requestJson<Entry[]>(
          "/entries",
          { signal: abortController.signal },
          activeUsername,
        );
        setEntries(allEntries);
      } catch (currentError) {
        if (currentError instanceof DOMException && currentError.name === "AbortError") {
          return;
        }

        setError(
          currentError instanceof Error
            ? currentError.message
            : "Unable to load your transactions.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadEntries();

    return () => abortController.abort();
  }, [activeUsername, refreshToken]);

  const availableMonths = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.date.slice(0, 7)))]
        .sort((left, right) => right.localeCompare(left)),
    [entries],
  );

  const availableAccounts = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.account).filter(Boolean) as string[])]
        .sort((left, right) => left.localeCompare(right)),
    [entries],
  );

  const availableCategories = useMemo(() => {
    const matchingEntries =
      filters.type === "all"
        ? entries
        : entries.filter((entry) => entry.type === filters.type);

    return [
      ...new Set(matchingEntries.map((entry) => entry.category).filter(Boolean) as string[]),
    ].sort((left, right) => left.localeCompare(right));
  }, [entries, filters.type]);

  const availableExpenseKinds = useMemo(
    () =>
      [...new Set(
        entries
          .filter((entry) => entry.type === "expense")
          .map((entry) => entry.entryKind)
          .filter(Boolean) as string[],
      )].sort((left, right) => left.localeCompare(right)),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const minAmount = Number(filters.minAmount);
    const maxAmount = Number(filters.maxAmount);

    const nextEntries = entries.filter((entry) => {
      if (filters.month !== "all" && !entry.date.startsWith(`${filters.month}-`)) {
        return false;
      }

      if (filters.type !== "all" && entry.type !== filters.type) {
        return false;
      }

      if (filters.account !== "all" && entry.account !== filters.account) {
        return false;
      }

      if (filters.category !== "all" && entry.category !== filters.category) {
        return false;
      }

      if (filters.entryKind !== "all" && entry.entryKind !== filters.entryKind) {
        return false;
      }

      if (filters.fromDate && entry.date < filters.fromDate) {
        return false;
      }

      if (filters.toDate && entry.date > filters.toDate) {
        return false;
      }

      if (filters.minAmount && Number.isFinite(minAmount) && entry.amount < minAmount) {
        return false;
      }

      if (filters.maxAmount && Number.isFinite(maxAmount) && entry.amount > maxAmount) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        entry.name,
        entry.entryCode,
        entry.account,
        entry.category,
        entry.subcategory,
        entry.entryKind,
        entry.counterparty,
        entry.notes,
        entry.comments,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return nextEntries.sort((left, right) => {
      switch (filters.sort) {
        case "date-asc":
          return `${left.date}-${left.updatedAt}`.localeCompare(
            `${right.date}-${right.updatedAt}`,
          );
        case "amount-desc":
          return right.amount - left.amount || right.date.localeCompare(left.date);
        case "amount-asc":
          return left.amount - right.amount || right.date.localeCompare(left.date);
        case "name-asc":
          return left.name.localeCompare(right.name) || right.date.localeCompare(left.date);
        case "date-desc":
        default:
          return `${right.date}-${right.updatedAt}`.localeCompare(
            `${left.date}-${left.updatedAt}`,
          );
      }
    });
  }, [entries, filters]);

  const categoryBreakdown = useMemo(
    () => buildBreakdown(filteredEntries, (entry) => entry.category ?? "Uncategorized", 8),
    [filteredEntries],
  );
  const accountBreakdown = useMemo(
    () => buildBreakdown(filteredEntries, (entry) => entry.account ?? "No account", 8),
    [filteredEntries],
  );
  const monthBreakdown = useMemo(
    () => buildBreakdown(filteredEntries, (entry) => entry.date.slice(0, 7), 8),
    [filteredEntries],
  );

  return {
    entries,
    filteredEntries,
    categoryBreakdown,
    accountBreakdown,
    monthBreakdown,
    isLoading,
    error,
    filters,
    availableMonths,
    availableAccounts,
    availableCategories,
    availableExpenseKinds,
    updateFilter<K extends keyof TransactionFilters>(
      field: K,
      value: TransactionFilters[K],
    ) {
      setFilters((currentFilters) => ({ ...currentFilters, [field]: value }));
    },
    resetFilters() {
      setFilters(initialFilters);
    },
  };
}
