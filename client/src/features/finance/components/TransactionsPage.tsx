import {
  formatMonthLabel,
  currency,
  formatDisplayValue,
  formatLongDate,
} from "../utils";
import type { BreakdownItem } from "../app/useTransactionsData";
import type { Entry, EntryType } from "../types";

type TransactionsPageFilters = {
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
  sort: "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "name-asc";
};

type TransactionsPageProps = {
  accountBreakdown: BreakdownItem[];
  availableAccounts: string[];
  availableCategories: string[];
  availableExpenseKinds: string[];
  availableMonths: string[];
  categoryBreakdown: BreakdownItem[];
  entries: Entry[];
  error: string | null;
  filters: TransactionsPageFilters;
  isLoading: boolean;
  monthBreakdown: BreakdownItem[];
  onDeleteEntry: (entry: Entry) => void;
  onEditEntry: (entry: Entry) => void;
  onFilterChange: <K extends keyof TransactionsPageFilters>(
    field: K,
    value: TransactionsPageFilters[K],
  ) => void;
  onResetFilters: () => void;
};

function BreakdownList({
  title,
  items,
  formatLabel = (value: string) => value,
}: {
  title: string;
  items: BreakdownItem[];
  formatLabel?: (value: string) => string;
}) {
  return (
    <section className="panel breakdown-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Breakdown</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="detail-stack">
        {items.length ? (
          items.map((item) => (
            <div className="detail-row compact" key={item.label}>
              <div className="detail-copy">
                <strong>{formatLabel(item.label)}</strong>
                <span>{item.count} rows</span>
              </div>
              <strong>{currency.format(item.total)}</strong>
            </div>
          ))
        ) : (
          <p className="empty-state">No matching rows.</p>
        )}
      </div>
    </section>
  );
}

export function TransactionsPage({
  accountBreakdown,
  availableAccounts,
  availableCategories,
  availableExpenseKinds,
  availableMonths,
  categoryBreakdown,
  entries,
  error,
  filters,
  isLoading,
  monthBreakdown,
  onDeleteEntry,
  onEditEntry,
  onFilterChange,
  onResetFilters,
}: TransactionsPageProps) {
  const incomeCount = entries.filter((entry) => entry.type === "income").length;
  const expenseCount = entries.length - incomeCount;
  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <>
      <section className="summary-card">
        <div className="summary-copy">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2>All transactions</h2>
          </div>

          <div className="metric-row metric-row-wide">
            <div className="metric-card">
              <span>Filtered rows</span>
              <strong>{entries.length}</strong>
            </div>
            <div className="metric-card">
              <span>Expenses</span>
              <strong>{expenseCount}</strong>
            </div>
            <div className="metric-card">
              <span>Incomings</span>
              <strong>{incomeCount}</strong>
            </div>
            <div className="metric-card emphasis">
              <span>Total amount</span>
              <strong>{currency.format(totalAmount)}</strong>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}

      <section className="panel transactions-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Filters</p>
            <h3>Search the full ledger</h3>
          </div>
          <button
            className="ghost-action"
            onClick={onResetFilters}
            type="button"
          >
            Reset filters
          </button>
        </div>

        <div className="transactions-filters">
          <label>
            Search
            <input
              onChange={(event) => onFilterChange("search", event.target.value)}
              placeholder="Name, ID, notes, account..."
              value={filters.search}
            />
          </label>
          <label>
            Month
            <select
              onChange={(event) => onFilterChange("month", event.target.value)}
              value={filters.month}
            >
              <option value="all">All months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select
              onChange={(event) =>
                onFilterChange(
                  "type",
                  event.target.value as TransactionsPageFilters["type"],
                )
              }
              value={filters.type}
            >
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Incomings</option>
            </select>
          </label>
          <label>
            Account
            <select
              onChange={(event) =>
                onFilterChange("account", event.target.value)
              }
              value={filters.account}
            >
              <option value="all">All accounts</option>
              {availableAccounts.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              onChange={(event) =>
                onFilterChange("category", event.target.value)
              }
              value={filters.category}
            >
              <option value="all">All categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            Expense type
            <select
              onChange={(event) =>
                onFilterChange("entryKind", event.target.value)
              }
              value={filters.entryKind}
            >
              <option value="all">All expense types</option>
              {availableExpenseKinds.map((entryKind) => (
                <option key={entryKind} value={entryKind}>
                  {entryKind}
                </option>
              ))}
            </select>
          </label>
          <label>
            From date
            <input
              onChange={(event) =>
                onFilterChange("fromDate", event.target.value)
              }
              type="date"
              value={filters.fromDate}
            />
          </label>
          <label>
            To date
            <input
              onChange={(event) => onFilterChange("toDate", event.target.value)}
              type="date"
              value={filters.toDate}
            />
          </label>
          <label>
            Min amount
            <input
              inputMode="decimal"
              onChange={(event) =>
                onFilterChange("minAmount", event.target.value)
              }
              placeholder="0"
              value={filters.minAmount}
            />
          </label>
          <label>
            Max amount
            <input
              inputMode="decimal"
              onChange={(event) =>
                onFilterChange("maxAmount", event.target.value)
              }
              placeholder="No limit"
              value={filters.maxAmount}
            />
          </label>
          <label>
            Sort
            <select
              onChange={(event) =>
                onFilterChange(
                  "sort",
                  event.target.value as TransactionsPageFilters["sort"],
                )
              }
              value={filters.sort}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
              <option value="name-asc">Name A-Z</option>
            </select>
          </label>
        </div>
      </section>

      <div className="breakdown-grid">
        <BreakdownList title="By category" items={categoryBreakdown} />
        <BreakdownList title="By account" items={accountBreakdown} />
        <BreakdownList
          title="By month"
          items={monthBreakdown}
          formatLabel={(month) => formatMonthLabel(month)}
        />
      </div>

      <section className="panel transactions-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Results</p>
            <h3>Matching entries</h3>
          </div>
          <span className="panel-meta">
            {isLoading ? "Loading..." : `${entries.length} rows`}
          </span>
        </div>

        <div className="table-scroll">
          <table className="ledger-table transactions-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Account</th>
                <th>Category</th>
                <th>Counterparty</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length ? (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.name}</strong>
                      <span>{entry.entryCode}</span>
                      {entry.notes || entry.comments ? (
                        <span>
                          {[entry.notes, entry.comments]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`kind-pill ${entry.type === "income" ? "income" : "expense"}`}
                      >
                        {entry.type === "income" ? "Income" : "Expense"}
                      </span>
                      <span>
                        {formatDisplayValue(entry.entryKind, "Regular")}
                      </span>
                    </td>
                    <td>{formatDisplayValue(entry.account, "No account")}</td>
                    <td>
                      <strong>
                        {formatDisplayValue(entry.category, "Uncategorized")}
                      </strong>
                      {entry.subcategory ? (
                        <span>{entry.subcategory}</span>
                      ) : null}
                      {entry.allocationMonths[0] ? (
                        <span>{entry.allocationMonths[0]}</span>
                      ) : null}
                    </td>
                    <td>{formatDisplayValue(entry.counterparty, "None")}</td>
                    <td
                      className={
                        entry.type === "income"
                          ? "amount-income"
                          : "amount-expense"
                      }
                    >
                      {currency.format(entry.amount)}
                    </td>
                    <td>{formatLongDate(entry.date)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="text-action"
                          onClick={() => onEditEntry(entry)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="text-action danger"
                          onClick={() => onDeleteEntry(entry)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="empty-cell" colSpan={8}>
                    No transactions match those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
