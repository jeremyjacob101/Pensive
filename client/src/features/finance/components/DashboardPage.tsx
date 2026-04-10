import { ChevronLeftIcon, ChevronRightIcon } from "../../../components/icons";
import {
  currency,
  formatDaysUntil,
  formatDisplayValue,
  formatLongDate,
  formatMonthLabel,
  formatShortDate,
} from "../utils";
import type {
  DashboardResponse,
  EvenUpDraft,
  EvenUpRecord,
  RecurringRule,
  RecurringRuleDraft,
  ReferenceData,
} from "../types";

type DashboardPageProps = {
  actionError: string | null;
  dashboard: DashboardResponse | null;
  dashboardError: string | null;
  evenUpDraft: EvenUpDraft | null;
  isDashboardLoading: boolean;
  isEvenUpSaving: boolean;
  isRecurringSaving: boolean;
  recurringDraft: RecurringRuleDraft | null;
  referenceData: ReferenceData;
  saveMessage: string | null;
  selectedMonth: string;
  totalTransactions: number;
  onCancelEvenUp: () => void;
  onCancelRecurring: () => void;
  onDeleteEvenUp: (record: EvenUpRecord) => void;
  onDeleteRecurring: (rule: RecurringRule) => void;
  onEditEvenUp: (record: EvenUpRecord) => void;
  onEditRecurring: (rule: RecurringRule) => void;
  onEvenUpDraftChange: <K extends keyof EvenUpDraft>(field: K, value: EvenUpDraft[K]) => void;
  onOpenEvenUp: () => void;
  onOpenRecurring: () => void;
  onRecurringDraftChange: <K extends keyof RecurringRuleDraft>(
    field: K,
    value: RecurringRuleDraft[K],
  ) => void;
  onRunRecurring: () => void;
  onSaveEvenUp: () => void;
  onSaveRecurring: () => void;
  onSelectedMonthChange: (updater: (current: string) => string) => void;
  shiftMonth: (monthKey: string, offset: number) => string;
};

function buildRecurringScheduleLabel(rule: RecurringRule) {
  return `${rule.frequency} on day ${rule.dayOfMonth}`;
}

export function DashboardPage({
  actionError,
  dashboard,
  dashboardError,
  evenUpDraft,
  isDashboardLoading,
  isEvenUpSaving,
  isRecurringSaving,
  recurringDraft,
  referenceData,
  saveMessage,
  selectedMonth,
  totalTransactions,
  onCancelEvenUp,
  onCancelRecurring,
  onDeleteEvenUp,
  onDeleteRecurring,
  onEditEvenUp,
  onEditRecurring,
  onEvenUpDraftChange,
  onOpenEvenUp,
  onOpenRecurring,
  onRecurringDraftChange,
  onRunRecurring,
  onSaveEvenUp,
  onSaveRecurring,
  onSelectedMonthChange,
  shiftMonth,
}: DashboardPageProps) {
  void isRecurringSaving;
  void recurringDraft;
  void referenceData;
  void onCancelRecurring;
  void onDeleteRecurring;
  void onEditRecurring;
  void onOpenRecurring;
  void onRecurringDraftChange;
  void onRunRecurring;
  void onSaveRecurring;

  return (
    <>
      <section className="summary-card">
        <div className="summary-copy">
          <div className="month-switcher">
            <button
              aria-label="Previous month"
              className="month-arrow"
              onClick={() => onSelectedMonthChange((current) => shiftMonth(current, -1))}
              type="button"
            >
              <ChevronLeftIcon />
            </button>
            <div>
              <p className="eyebrow">Selected month</p>
              <h2>{formatMonthLabel(selectedMonth)}</h2>
            </div>
            <button
              aria-label="Next month"
              className="month-arrow"
              onClick={() => onSelectedMonthChange((current) => shiftMonth(current, 1))}
              type="button"
            >
              <ChevronRightIcon />
            </button>
          </div>

            <div className="metric-row metric-row-wide">
            <div className="metric-card">
              <span>Income</span>
              <strong>{currency.format(dashboard?.totals.income ?? 0)}</strong>
            </div>
            <div className="metric-card">
              <span>Expenses</span>
              <strong>{currency.format(dashboard?.totals.expenses ?? 0)}</strong>
            </div>
            <div className="metric-card emphasis">
              <span>Net</span>
              <strong>{currency.format(dashboard?.totals.net ?? 0)}</strong>
            </div>
            <div className="metric-card">
              <span>Recurring rules</span>
              <strong>{dashboard?.recurringRules.length ?? 0}</strong>
            </div>
            <div className="metric-card">
              <span>Even-up open</span>
              <strong>{dashboard?.evenUpSummary.openCount ?? 0}</strong>
            </div>
          </div>
        </div>
      </section>

      {dashboardError ? <div className="status-banner error">{dashboardError}</div> : null}
      {actionError ? <div className="status-banner error">{actionError}</div> : null}
      {saveMessage ? <div className="status-banner success">{saveMessage}</div> : null}

      <section className="dashboard-layout">
        <div className="dashboard-main-column">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Recurring</p>
                <h3>Recurring rules</h3>
              </div>
            </div>
            <p className="panel-meta">
              Recurring automation is disabled for now. This list is display-only until you decide
              how it should behave.
            </p>

            <div className="detail-stack">
              {dashboard?.recurringRules.length ? (
                dashboard.recurringRules.map((rule) => (
                  <div className="detail-row" key={rule.id}>
                    <div className="detail-copy">
                      <div className="detail-title-row">
                        <strong>{rule.name}</strong>
                        <span className={`kind-pill ${rule.type === "income" ? "income" : "expense"}`}>
                          {rule.type === "income" ? "Income" : "Expense"}
                        </span>
                        <span className={`kind-pill ${rule.status === "add" ? "income" : "expense"}`}>
                          {rule.status === "add" ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p>
                        {buildRecurringScheduleLabel(rule)} · {currency.format(rule.amount)} ·{" "}
                        {formatDisplayValue(rule.account, "No account")}
                      </p>
                      <p>
                        {formatDisplayValue(rule.category, "Uncategorized")} ·{" "}
                        {formatDisplayValue(rule.counterparty, rule.type === "expense" ? "No payee" : "No payer")}
                      </p>
                      <p>
                        Start {formatLongDate(rule.startDate)} · Triggered {rule.triggeredCount} times
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">Recurring rules will appear here when they exist in imported data.</p>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Even-Up</p>
                <h3>Settlements</h3>
              </div>
              <button className="mini-action" onClick={onOpenEvenUp} type="button">
                New settlement
              </button>
            </div>

            {evenUpDraft ? (
              <div className="inline-form">
                <div className="inline-form-grid">
                  <label>
                    Status
                    <select
                      onChange={(event) => onEvenUpDraftChange("status", event.target.value)}
                      value={evenUpDraft.status}
                    >
                      <option value="Open">Open</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </label>
                  <label>
                    Paid
                    <input
                      inputMode="decimal"
                      onChange={(event) => onEvenUpDraftChange("paid", event.target.value)}
                      value={evenUpDraft.paid}
                    />
                  </label>
                  <label>
                    Start
                    <input
                      onChange={(event) => onEvenUpDraftChange("startDate", event.target.value)}
                      type="date"
                      value={evenUpDraft.startDate}
                    />
                  </label>
                  <label>
                    End
                    <input
                      onChange={(event) => onEvenUpDraftChange("endDate", event.target.value)}
                      type="date"
                      value={evenUpDraft.endDate}
                    />
                  </label>
                  <label>
                    From
                    <input
                      onChange={(event) => onEvenUpDraftChange("from", event.target.value)}
                      value={evenUpDraft.from}
                    />
                  </label>
                  <label>
                    To
                    <input
                      onChange={(event) => onEvenUpDraftChange("to", event.target.value)}
                      value={evenUpDraft.to}
                    />
                  </label>
                  <label className="full-width">
                    Notes
                    <textarea
                      onChange={(event) => onEvenUpDraftChange("notes", event.target.value)}
                      rows={2}
                      value={evenUpDraft.notes}
                    />
                  </label>
                </div>

                <div className="inline-form-actions">
                  <button className="ghost-action" onClick={onCancelEvenUp} type="button">
                    Cancel
                  </button>
                  <button
                    className="save-action expense"
                    disabled={isEvenUpSaving}
                    onClick={onSaveEvenUp}
                    type="button"
                  >
                    {isEvenUpSaving ? "Saving..." : evenUpDraft.id ? "Save settlement" : "Add settlement"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="detail-stack">
              {dashboard?.evenUpRecords.length ? (
                dashboard.evenUpRecords.map((record) => (
                  <div className="detail-row" key={record.id}>
                    <div className="detail-copy">
                      <div className="detail-title-row">
                        <strong>{record.code}</strong>
                        <span className={`kind-pill ${record.status === "Completed" ? "income" : "expense"}`}>
                          {record.status}
                        </span>
                      </div>
                      <p>
                        {formatDisplayValue(record.from, "Unknown")}
                        {" -> "}
                        {formatDisplayValue(record.to, "Unknown")}
                      </p>
                      <p>
                        {formatLongDate(record.startDate)} to {formatLongDate(record.endDate)} · Amount{" "}
                        {currency.format(record.amount)} · Remaining {currency.format(record.remaining)}
                      </p>
                    </div>

                    <div className="detail-actions">
                      <button className="text-action" onClick={() => onEditEvenUp(record)} type="button">
                        Edit
                      </button>
                      <button className="text-action danger" onClick={() => onDeleteEvenUp(record)} type="button">
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">Even-up periods calculate from your payback and giveback entries.</p>
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Ledger</p>
                <h3>Month entries</h3>
              </div>
              <span className="panel-meta">
                {isDashboardLoading ? "Loading..." : `${totalTransactions} entries`}
              </span>
            </div>

            <div className="ledger-grid">
              <div className="table-shell">
                <div className="table-title-row">
                  <h4>Expenses</h4>
                  <span>{dashboard?.counts.expenses ?? 0}</span>
                </div>
                <div className="table-scroll">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.expenseEntries.length ? (
                        dashboard.expenseEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <strong>{entry.name}</strong>
                              <span>{entry.entryCode}</span>
                            </td>
                            <td>{formatDisplayValue(entry.entryKind, "Regular")}</td>
                            <td>
                              {formatDisplayValue(entry.category, "Uncategorized")}
                              <span>{formatDisplayValue(entry.counterparty, "No vendor")}</span>
                            </td>
                            <td className="amount-expense">{currency.format(entry.amount)}</td>
                            <td>{formatShortDate(entry.date)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="empty-cell">
                            No expenses yet for this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-shell">
                <div className="table-title-row">
                  <h4>Incomings</h4>
                  <span>{dashboard?.counts.income ?? 0}</span>
                </div>
                <div className="table-scroll">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Account</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.incomeEntries.length ? (
                        dashboard.incomeEntries.map((entry) => (
                          <tr key={entry.id}>
                            <td>
                              <strong>{entry.name}</strong>
                              <span>{entry.entryCode}</span>
                            </td>
                            <td>{formatDisplayValue(entry.category, "Misc")}</td>
                            <td>
                              {formatDisplayValue(entry.account, "No account")}
                              <span>{formatDisplayValue(entry.counterparty, "Unknown payer")}</span>
                            </td>
                            <td className="amount-income">{currency.format(entry.amount)}</td>
                            <td>{formatShortDate(entry.date)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="empty-cell">
                            No incomings yet for this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div className="dashboard-side-column">
          <article className="panel compact-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Top spend</p>
                <h3>Categories</h3>
              </div>
            </div>

            <div className="category-list">
              {dashboard?.categoryBreakdown.expense.length ? (
                dashboard.categoryBreakdown.expense.slice(0, 6).map((category) => {
                  const width =
                    dashboard.totals.expenses > 0
                      ? Math.max(10, (category.total / dashboard.totals.expenses) * 100)
                      : 10;

                  return (
                    <div className="category-row" key={category.category}>
                      <div className="category-copy">
                        <strong>{category.category}</strong>
                        <span>{currency.format(category.total)}</span>
                      </div>
                      <div className="category-bar">
                        <div style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="empty-state">Expense categories will show up here.</p>
              )}
            </div>
          </article>

          <article className="panel compact-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Important</p>
                <h3>Dates</h3>
              </div>
            </div>

            <div className="detail-stack">
              {dashboard?.importantDates.length ? (
                dashboard.importantDates.slice(0, 6).map((item) => (
                  <div className="detail-row compact" key={item.id}>
                    <div className="detail-copy">
                      <strong>{item.name}</strong>
                      <p>{formatLongDate(item.date)}</p>
                    </div>
                    <span className={`date-chip ${item.isPast ? "past" : "upcoming"}`}>
                      {formatDaysUntil(item.daysUntil)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="empty-state">Important dates will show up here.</p>
              )}
            </div>
          </article>

          <article className="panel compact-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Snapshot</p>
                <h3>Right now</h3>
              </div>
            </div>

            <div className="detail-stack">
              <div className="detail-row compact">
                <div className="detail-copy">
                  <strong>Next recurring trigger</strong>
                  <p>{dashboard?.recurringSummary.nextRuleName ?? "Nothing scheduled"}</p>
                </div>
                <span className="date-chip upcoming">
                  {dashboard?.recurringSummary.nextTriggerDate
                    ? formatShortDate(dashboard.recurringSummary.nextTriggerDate)
                    : "None"}
                </span>
              </div>

              <div className="detail-row compact">
                <div className="detail-copy">
                  <strong>Upcoming rules</strong>
                  <p>Due within the next two weeks</p>
                </div>
                <span className="date-chip upcoming">
                  {dashboard?.recurringSummary.upcomingCount ?? 0}
                </span>
              </div>

              <div className="detail-row compact">
                <div className="detail-copy">
                  <strong>Outstanding even-up</strong>
                  <p>Open settlements still on the board</p>
                </div>
                <span className="date-chip past">
                  {currency.format(dashboard?.evenUpSummary.outstanding ?? 0)}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
