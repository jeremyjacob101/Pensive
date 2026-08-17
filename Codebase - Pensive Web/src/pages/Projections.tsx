import { buildProjectionSeries, convertProjectionAmount, formatProjectionDate, formatProjectionMoney, isUsableProjectionRate, latestEntriesByBank, localIsoDate, otherProjectionCurrency, resolvedProjectionCurrency } from "../helpers/projections";
import type { ProjectionBank, ProjectionBankDraft, ProjectionBankId, ProjectionChartMode, ProjectionCurrency, ProjectionCurrencySettings, ProjectionEntry, ProjectionEntryDraft, ProjectionHorizon } from "../types/projections";
import { ArrowDown, ArrowUp, Banknote, CalendarPlus, Eye, Pencil, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { ProjectionCurrencySheet } from "../components/ProjectionCurrencySheet";
import { ProjectionEntrySheet } from "../components/ProjectionEntrySheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProjectionBankSheet } from "../components/ProjectionBankSheet";
import { ProjectionChart } from "../components/ProjectionChart";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@pensive/convex-api";
import { createPortal } from "react-dom";

const HORIZONS: ProjectionHorizon[] = [1, 3, 5, 10, 15, 20, 25, 30, 40, 50];
const EMPTY_BANKS: ProjectionBank[] = [];
const EMPTY_ENTRIES: ProjectionEntry[] = [];
const DEFAULT_CURRENCY_SETTINGS: ProjectionCurrencySettings = {
  displayCurrency: "ILS",
  manualUsdIlsRate: null,
  liveUsdIlsRate: null,
  liveRateDate: null,
  liveRateFetchedAt: null,
  rateSource: "Frankfurter",
};
const PREVIEW_USER_ID = "projection-preview-user" as ProjectionBank["userId"];
const previewBankId = (value: string) => value as ProjectionBankId;
const previewEntryId = (value: string) => value as ProjectionEntry["_id"];
const PREVIEW_BANKS: ProjectionBank[] = [
  {
    _id: previewBankId("preview-everyday"),
    _creationTime: 1,
    userId: PREVIEW_USER_ID,
    name: "Everyday",
    color: "#4389FF",
    currency: "ILS",
    interestEnabled: true,
    annualInterestRate: 0.5,
    compounding: "monthly",
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    _id: previewBankId("preview-savings"),
    _creationTime: 2,
    userId: PREVIEW_USER_ID,
    name: "Savings",
    color: "#FF6758",
    currency: "USD",
    interestEnabled: true,
    annualInterestRate: 2,
    compounding: "monthly",
    sortOrder: 1,
    createdAt: 2,
    updatedAt: 2,
  },
  {
    _id: previewBankId("preview-investments"),
    _creationTime: 3,
    userId: PREVIEW_USER_ID,
    name: "Investments",
    color: "#5EAE8C",
    currency: "ILS",
    interestEnabled: true,
    annualInterestRate: 6.5,
    compounding: "monthly",
    sortOrder: 2,
    createdAt: 3,
    updatedAt: 3,
  },
];
const PREVIEW_ENTRY_VALUES: Array<
  [string, ProjectionBankId, string, number, string]
> = [
  [
    "preview-entry-1",
    PREVIEW_BANKS[0]._id,
    "2024-01-31",
    31_200,
    "Opening snapshot",
  ],
  [
    "preview-entry-2",
    PREVIEW_BANKS[1]._id,
    "2024-01-31",
    18_100,
    "Monthly contribution",
  ],
  [
    "preview-entry-3",
    PREVIEW_BANKS[2]._id,
    "2024-01-31",
    70_600,
    "Portfolio close",
  ],
  [
    "preview-entry-4",
    PREVIEW_BANKS[0]._id,
    "2024-08-31",
    42_900,
    "End of month",
  ],
  [
    "preview-entry-5",
    PREVIEW_BANKS[1]._id,
    "2024-08-31",
    20_400,
    "Monthly contribution",
  ],
  [
    "preview-entry-6",
    PREVIEW_BANKS[2]._id,
    "2024-08-31",
    82_100,
    "Portfolio close",
  ],
  [
    "preview-entry-7",
    PREVIEW_BANKS[0]._id,
    "2025-03-31",
    61_300,
    "Annual bonus",
  ],
  [
    "preview-entry-8",
    PREVIEW_BANKS[1]._id,
    "2025-03-31",
    23_800,
    "Monthly contribution",
  ],
  [
    "preview-entry-9",
    PREVIEW_BANKS[2]._id,
    "2025-03-31",
    101_500,
    "Portfolio close",
  ],
  [
    "preview-entry-10",
    PREVIEW_BANKS[0]._id,
    "2025-10-31",
    41_800,
    "Home repairs",
  ],
  [
    "preview-entry-11",
    PREVIEW_BANKS[1]._id,
    "2025-10-31",
    25_600,
    "Monthly contribution",
  ],
  [
    "preview-entry-12",
    PREVIEW_BANKS[2]._id,
    "2025-10-31",
    120_900,
    "Portfolio close",
  ],
  [
    "preview-entry-13",
    PREVIEW_BANKS[0]._id,
    "2026-08-10",
    54_760,
    "Paycheck deposit",
  ],
  [
    "preview-entry-14",
    PREVIEW_BANKS[1]._id,
    "2026-08-10",
    26_900,
    "Monthly contribution",
  ],
  [
    "preview-entry-15",
    PREVIEW_BANKS[2]._id,
    "2026-08-10",
    135_720,
    "Market close",
  ],
];
const PREVIEW_ENTRIES: ProjectionEntry[] = PREVIEW_ENTRY_VALUES.map((
  [id, bankId, date, amount, note],
  index,
) => ({
  _id: previewEntryId(id),
  _creationTime: 100 + index,
  userId: PREVIEW_USER_ID,
  bankId,
  date,
  amount,
  currency: resolvedProjectionCurrency(
    PREVIEW_BANKS.find((bank) => bank._id === bankId)?.currency,
  ),
  note,
  createdAt: 100 + index,
  updatedAt: 100 + index,
}));
const PROJECTION_PREVIEW_DATA = {
  banks: PREVIEW_BANKS,
  entries: PREVIEW_ENTRIES,
  settings: {
    displayCurrency: "ILS" as const,
    manualUsdIlsRate: null,
    liveUsdIlsRate: 3.0009,
    liveRateDate: "2026-08-11",
    liveRateFetchedAt: Date.now(),
    rateSource: "Frankfurter",
  },
};

type EditorState =
  | { kind: "bank"; bank?: ProjectionBank }
  | { kind: "entry"; entry?: ProjectionEntry; initialBankId?: ProjectionBankId }
  | null;

type ConfirmState =
  | { kind: "bank"; id: ProjectionBankId; title: string }
  | { kind: "entry"; id: ProjectionEntry["_id"]; title: string }
  | null;

export function Projections() {
  const previewMode =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const remoteData = useQuery(api.projections.list, previewMode ? "skip" : {});
  const data = previewMode ? PROJECTION_PREVIEW_DATA : remoteData;
  const createBank = useMutation(api.projections.createBank);
  const updateBank = useMutation(api.projections.updateBank);
  const removeBank = useMutation(api.projections.removeBank);
  const reorderBanks = useMutation(api.projections.reorderBanks);
  const createEntry = useMutation(api.projections.createEntry);
  const updateEntry = useMutation(api.projections.updateEntry);
  const removeEntry = useMutation(api.projections.removeEntry);
  const updateCurrencySettings = useMutation(
    api.projections.setCurrencySettings,
  );
  const refreshRateAction = useAction(api.projections.refreshExchangeRate);

  const banks = data?.banks ?? EMPTY_BANKS;
  const entries = data?.entries ?? EMPTY_ENTRIES;
  const [hiddenBankIds, setHiddenBankIds] = useState<Set<ProjectionBankId>>(
    () => new Set(),
  );
  const selectedBankIds = useMemo(
    () =>
      new Set(
        banks.map((bank) => bank._id).filter((id) => !hiddenBankIds.has(id)),
      ),
    [banks, hiddenBankIds],
  );
  const [chartMode, setChartMode] = useState<ProjectionChartMode>("stacked");
  const [interestOn, setInterestOn] = useState(true);
  const [totalVisible, setTotalVisible] = useState(true);
  const [horizonYears, setHorizonYears] = useState<number>(20);
  const [customHorizonOpen, setCustomHorizonOpen] = useState(false);
  const [customHorizon, setCustomHorizon] = useState("12");
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [saving, setSaving] = useState(false);
  const [refreshingRate, setRefreshingRate] = useState(false);
  const [error, setError] = useState("");
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [currencyOverride, setCurrencyOverride] =
    useState<ProjectionCurrencySettings | null>(null);
  const rateRequested = useRef(false);
  const currencySettings =
    currencyOverride ??
    (data?.settings as ProjectionCurrencySettings | undefined) ??
    DEFAULT_CURRENCY_SETTINGS;

  const effectiveUsdIlsRate =
    currencySettings.manualUsdIlsRate ?? currencySettings.liveUsdIlsRate;
  const displayCurrency = currencySettings.displayCurrency;

  const bankById = useMemo(
    () => new Map(banks.map((bank) => [bank._id, bank])),
    [banks],
  );
  const latestByBank = useMemo(
    () => latestEntriesByBank(banks, entries),
    [banks, entries],
  );
  const conversionBlocked = useMemo(
    () =>
      !isUsableProjectionRate(effectiveUsdIlsRate) &&
      entries.some(
        (entry) =>
          selectedBankIds.has(entry.bankId) &&
          entry.date <= localIsoDate() &&
          resolvedProjectionCurrency(entry.currency) !== displayCurrency,
      ),
    [displayCurrency, effectiveUsdIlsRate, entries, selectedBankIds],
  );
  const series = useMemo(
    () =>
      buildProjectionSeries({
        banks,
        entries,
        selectedBankIds,
        horizonYears,
        interestOn,
        displayCurrency,
        usdIlsRate: effectiveUsdIlsRate,
      }),
    [
      banks,
      displayCurrency,
      effectiveUsdIlsRate,
      entries,
      horizonYears,
      interestOn,
      selectedBankIds,
    ],
  );
  const recentEntries = useMemo(
    () =>
      entries.toSorted(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
      ),
    [entries],
  );
  const visibleEntries = showAllEntries
    ? recentEntries
    : recentEntries.slice(0, 6);
  const todayTotal = conversionBlocked
    ? null
    : (series.findLast((point) => !point.isProjected)?.total ?? 0);
  const projectedTotal = conversionBlocked
    ? null
    : (series.at(-1)?.total ?? todayTotal ?? 0);
  const growth =
    todayTotal === null || projectedTotal === null
      ? null
      : projectedTotal - todayTotal;

  const toggleBank = (id: ProjectionBankId) => {
    setHiddenBankIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runMutation = async (
    work: () => Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    setSaving(true);
    setError("");
    try {
      await work();
      onSuccess?.();
      return true;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Something went wrong. Please try again.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const refreshExchangeRate = useCallback(
    async (force = true) => {
      if (previewMode) return;
      setRefreshingRate(true);
      setError("");
      try {
        const result = await refreshRateAction({ force });
        setCurrencyOverride((previous) => ({
          ...(previous ??
            (data?.settings as ProjectionCurrencySettings | undefined) ??
            DEFAULT_CURRENCY_SETTINGS),
          liveUsdIlsRate: result.rate,
          liveRateDate: result.rateDate,
          liveRateFetchedAt: result.fetchedAt,
          rateSource: result.source,
        }));
      } catch (rateError) {
        setError(
          rateError instanceof Error
            ? rateError.message
            : "Could not refresh the USD to ILS rate.",
        );
      } finally {
        setRefreshingRate(false);
      }
    },
    [data?.settings, previewMode, refreshRateAction],
  );

  useEffect(() => {
    if (previewMode || remoteData === undefined || rateRequested.current) {
      return;
    }
    rateRequested.current = true;
    void refreshExchangeRate(false);
  }, [previewMode, refreshExchangeRate, remoteData]);

  const saveCurrencySettings = async (
    nextDisplayCurrency: ProjectionCurrency,
    manualUsdIlsRate: number | null,
  ) => {
    const previous = currencySettings;
    setCurrencyOverride({
      ...currencySettings,
      displayCurrency: nextDisplayCurrency,
      manualUsdIlsRate,
    });
    if (previewMode) {
      setCurrencySheetOpen(false);
      return;
    }
    const payload =
      manualUsdIlsRate === null
        ? { displayCurrency: nextDisplayCurrency }
        : { displayCurrency: nextDisplayCurrency, manualUsdIlsRate };
    const saved = await runMutation(
      () => updateCurrencySettings(payload),
      () => setCurrencySheetOpen(false),
    );
    if (!saved) setCurrencyOverride(previous);
  };

  const saveBank = async (draft: ProjectionBankDraft) => {
    const activeBank = editor?.kind === "bank" ? editor.bank : undefined;
    await runMutation(
      () =>
        activeBank
          ? updateBank({
              id: activeBank._id,
              name: draft.name,
              color: draft.color,
              currency: draft.currency,
              interestEnabled: draft.interestEnabled,
              annualInterestRate: draft.annualInterestRate,
              compounding: draft.compounding,
            })
          : createBank(draft),
      () => setEditor(null),
    );
  };

  const saveEntry = async (draft: ProjectionEntryDraft) => {
    const activeEntry = editor?.kind === "entry" ? editor.entry : undefined;
    await runMutation(
      () =>
        activeEntry
          ? updateEntry({ id: activeEntry._id, ...draft })
          : createEntry(draft),
      () => setEditor(null),
    );
  };

  const deleteConfirmed = async () => {
    if (!confirm) return;
    await runMutation(
      () =>
        confirm.kind === "bank"
          ? removeBank({ id: confirm.id })
          : removeEntry({ id: confirm.id }),
      () => setConfirm(null),
    );
  };

  const moveBank = async (id: ProjectionBankId, direction: -1 | 1) => {
    const currentIndex = banks.findIndex((bank) => bank._id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= banks.length)
      return;
    const ids = banks.map((bank) => bank._id);
    [ids[currentIndex], ids[targetIndex]] = [
      ids[targetIndex],
      ids[currentIndex],
    ];
    await runMutation(() => reorderBanks({ ids }));
  };

  const applyCustomHorizon = () => {
    const years = Math.round(Number(customHorizon));
    if (!Number.isFinite(years) || years < 1 || years > 100) {
      setError("Custom projection horizon must be between 1 and 100 years.");
      return;
    }
    setHorizonYears(years);
    setCustomHorizonOpen(false);
    setError("");
  };

  return (
    <section className="projections-page">
      <header className="projections-header">
        <div>
          <h1>Projections</h1>
          <p>Model your balances and see where they could grow.</p>
        </div>
        <div className="projections-header-actions">
          <div className="projection-currency-toolbar">
            <div
              className="projection-currency-toggle"
              aria-label="Display currency"
            >
              {(["ILS", "USD"] as const).map((currency) => (
                <button
                  key={currency}
                  type="button"
                  className={displayCurrency === currency ? "active" : ""}
                  onClick={() =>
                    void saveCurrencySettings(
                      currency,
                      currencySettings.manualUsdIlsRate,
                    )
                  }
                  aria-pressed={displayCurrency === currency}
                >
                  {currency === "ILS" ? "₪ ILS" : "$ USD"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="projection-rate-button"
              onClick={() => setCurrencySheetOpen(true)}
            >
              {refreshingRate ? (
                <RefreshCw size={14} className="projection-spinning" />
              ) : (
                <Settings2 size={14} />
              )}
              <span>
                {effectiveUsdIlsRate
                  ? `1 USD = ₪${effectiveUsdIlsRate.toFixed(4)}`
                  : "Set exchange rate"}
                <small>
                  {currencySettings.manualUsdIlsRate !== null
                    ? "Custom rate"
                    : refreshingRate
                      ? "Refreshing live rate"
                      : "Live rate"}
                </small>
              </span>
            </button>
          </div>
          <button
            type="button"
            className="projection-button secondary"
            onClick={() => setEditor({ kind: "bank" })}
          >
            <Banknote size={16} />
            Add bank
          </button>
          <button
            type="button"
            className="projection-button primary"
            disabled={banks.length === 0}
            onClick={() => setEditor({ kind: "entry" })}
          >
            <Plus size={16} />
            Add balance
          </button>
        </div>
      </header>

      <div className="projection-summary" aria-label="Projection summary">
        <SummaryMetric
          label="Today"
          value={todayTotal}
          currency={displayCurrency}
          usdIlsRate={effectiveUsdIlsRate}
        />
        <SummaryMetric
          label={`Projected · ${horizonYears}Y`}
          value={projectedTotal}
          currency={displayCurrency}
          usdIlsRate={effectiveUsdIlsRate}
        />
        <SummaryMetric
          label="Growth"
          value={growth}
          currency={displayCurrency}
          usdIlsRate={effectiveUsdIlsRate}
          positive={growth === null ? undefined : growth >= 0}
        />
      </div>

      {error ? (
        <div className="projection-error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      ) : null}

      {data === undefined ? (
        <div className="projection-loading" aria-live="polite">
          <span />
          <span />
          <span />
        </div>
      ) : banks.length === 0 ? (
        <ProjectionEmptyState onAdd={() => setEditor({ kind: "bank" })} />
      ) : (
        <>
          <section
            className="projection-chart-section"
            aria-label="Balance projection chart"
          >
            <div className="projection-chart-controls">
              <ControlGroup label="Chart mode">
                <div className="projection-segmented">
                  {(["stacked", "lines", "total"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={chartMode === mode ? "active" : ""}
                      onClick={() => setChartMode(mode)}
                    >
                      {mode[0].toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </ControlGroup>

              <ControlGroup label="Interest">
                <label className="projection-inline-switch">
                  <input
                    type="checkbox"
                    checked={interestOn}
                    onChange={(event) => setInterestOn(event.target.checked)}
                  />
                  <span>Interest {interestOn ? "on" : "off"}</span>
                </label>
              </ControlGroup>

              <ControlGroup
                label="Projection horizon"
                className="projection-horizon-group"
              >
                <div className="projection-horizon-scroll">
                  {HORIZONS.map((years) => (
                    <button
                      key={years}
                      type="button"
                      className={
                        horizonYears === years && !customHorizonOpen
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setHorizonYears(years);
                        setCustomHorizonOpen(false);
                      }}
                    >
                      {years}Y
                    </button>
                  ))}
                  <button
                    type="button"
                    className={
                      customHorizonOpen ||
                      !HORIZONS.includes(horizonYears as ProjectionHorizon)
                        ? "active"
                        : ""
                    }
                    onClick={() => setCustomHorizonOpen((open) => !open)}
                  >
                    Custom
                  </button>
                </div>
                {customHorizonOpen ? (
                  <div className="projection-custom-horizon">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={customHorizon}
                      onChange={(event) => setCustomHorizon(event.target.value)}
                      aria-label="Custom horizon in years"
                    />
                    <span>years</span>
                    <button type="button" onClick={applyCustomHorizon}>
                      Apply
                    </button>
                  </div>
                ) : null}
              </ControlGroup>
            </div>

            <div className="projection-select-all-row">
              <button
                type="button"
                onClick={() => setHiddenBankIds(new Set())}
                disabled={selectedBankIds.size === banks.length}
              >
                Show all banks
              </button>
              <span>
                {selectedBankIds.size} of {banks.length} selected
              </span>
            </div>

            <ProjectionChart
              points={series}
              banks={banks}
              selectedBankIds={selectedBankIds}
              totalVisible={totalVisible}
              mode={chartMode}
              displayCurrency={displayCurrency}
              usdIlsRate={effectiveUsdIlsRate}
              emptyMessage={
                conversionBlocked
                  ? "Fetching an exchange rate before combining ILS and USD balances…"
                  : undefined
              }
              onToggleBank={toggleBank}
              onToggleTotal={() => setTotalVisible((visible) => !visible)}
            />
          </section>

          <div className="projection-data-panels">
            <section className="projection-data-panel">
              <header>
                <h2>Banks</h2>
                <span>Reorder with the arrow controls</span>
              </header>
              <div className="projection-table-wrap">
                <table className="projection-table">
                  <thead>
                    <tr>
                      <th>Bank</th>
                      <th>Current balance</th>
                      <th>Annual rate</th>
                      <th>Last updated</th>
                      <th className="projection-actions-column">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.map((bank, index) => {
                      const latest = latestByBank.get(bank._id);
                      return (
                        <tr key={bank._id}>
                          <td>
                            <span className="projection-bank-name">
                              <i style={{ backgroundColor: bank.color }} />
                              {bank.name}
                              <small className="projection-currency-badge">
                                {resolvedProjectionCurrency(bank.currency)}
                              </small>
                            </span>
                          </td>
                          <td>
                            {latest ? (
                              <ProjectionMoneyPair
                                amount={latest.amount}
                                enteredCurrency={resolvedProjectionCurrency(
                                  latest.currency,
                                )}
                                displayCurrency={displayCurrency}
                                usdIlsRate={effectiveUsdIlsRate}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            {bank.interestEnabled
                              ? `${bank.annualInterestRate.toFixed(2)}% · ${bank.compounding}`
                              : "Off"}
                          </td>
                          <td>
                            {latest
                              ? formatProjectionDate(latest.date)
                              : "No balance yet"}
                          </td>
                          <td>
                            <div className="projection-row-actions">
                              <button
                                type="button"
                                onClick={() => toggleBank(bank._id)}
                                className={
                                  selectedBankIds.has(bank._id) ? "active" : ""
                                }
                                aria-label={`${selectedBankIds.has(bank._id) ? "Hide" : "Show"} ${bank.name} on chart`}
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void moveBank(bank._id, -1)}
                                disabled={saving || index === 0}
                                aria-label={`Move ${bank.name} up`}
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void moveBank(bank._id, 1)}
                                disabled={saving || index === banks.length - 1}
                                aria-label={`Move ${bank.name} down`}
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditor({ kind: "bank", bank })
                                }
                                aria-label={`Edit ${bank.name}`}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="destructive"
                                onClick={() =>
                                  setConfirm({
                                    kind: "bank",
                                    id: bank._id,
                                    title: bank.name,
                                  })
                                }
                                aria-label={`Delete ${bank.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="projection-panel-add"
                onClick={() => setEditor({ kind: "bank" })}
              >
                <Plus size={15} /> Add bank
              </button>
            </section>

            <section className="projection-data-panel">
              <header>
                <h2>Recent balance history</h2>
                {recentEntries.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllEntries((visible) => !visible)}
                  >
                    {showAllEntries ? "Show recent" : "View all"}
                  </button>
                ) : null}
              </header>
              {visibleEntries.length === 0 ? (
                <div className="projection-panel-empty">
                  Add a balance to start the history for your banks.
                </div>
              ) : (
                <div className="projection-table-wrap">
                  <table className="projection-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Bank</th>
                        <th>Amount</th>
                        <th>Note</th>
                        <th className="projection-actions-column">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEntries.map((entry) => {
                        const bank = bankById.get(entry.bankId);
                        if (!bank) return null;
                        return (
                          <tr key={entry._id}>
                            <td>{formatProjectionDate(entry.date)}</td>
                            <td>
                              <span className="projection-bank-name">
                                <i style={{ backgroundColor: bank.color }} />
                                {bank.name}
                                <small className="projection-currency-badge">
                                  {resolvedProjectionCurrency(entry.currency)}
                                </small>
                              </span>
                            </td>
                            <td>
                              <ProjectionMoneyPair
                                amount={entry.amount}
                                enteredCurrency={resolvedProjectionCurrency(
                                  entry.currency,
                                )}
                                displayCurrency={displayCurrency}
                                usdIlsRate={effectiveUsdIlsRate}
                              />
                            </td>
                            <td className="projection-entry-note">
                              {entry.note || "—"}
                            </td>
                            <td>
                              <div className="projection-row-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditor({ kind: "entry", entry })
                                  }
                                  aria-label={`Edit ${bank.name} balance from ${entry.date}`}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="destructive"
                                  onClick={() =>
                                    setConfirm({
                                      kind: "entry",
                                      id: entry._id,
                                      title: `${bank.name} balance from ${formatProjectionDate(entry.date)}`,
                                    })
                                  }
                                  aria-label={`Delete ${bank.name} balance from ${entry.date}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                type="button"
                className="projection-panel-add"
                onClick={() => setEditor({ kind: "entry" })}
              >
                <Plus size={15} /> Add balance
              </button>
            </section>
          </div>
        </>
      )}

      {editor?.kind === "bank" ? (
        <ProjectionBankSheet
          bank={editor.bank}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveBank}
        />
      ) : null}
      {editor?.kind === "entry" ? (
        <ProjectionEntrySheet
          banks={banks}
          entry={editor.entry}
          initialBankId={editor.initialBankId}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={saveEntry}
        />
      ) : null}
      {currencySheetOpen ? (
        <ProjectionCurrencySheet
          settings={currencySettings}
          displayCurrency={displayCurrency}
          saving={saving}
          refreshing={refreshingRate}
          onClose={() => setCurrencySheetOpen(false)}
          onRefresh={() => refreshExchangeRate(true)}
          onSave={saveCurrencySettings}
        />
      ) : null}
      {confirm ? (
        <ProjectionConfirmDialog
          state={confirm}
          saving={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void deleteConfirmed()}
        />
      ) : null}
    </section>
  );
}

function SummaryMetric({ label, value, currency, usdIlsRate, positive }: {
  label: string;
  value: number | null;
  currency: ProjectionCurrency;
  usdIlsRate: number | null;
  positive?: boolean;
}) {
  const secondaryCurrency = otherProjectionCurrency(currency);
  const secondaryValue =
    value === null
      ? null
      : convertProjectionAmount(value, currency, secondaryCurrency, usdIlsRate);
  return (
    <div
      className={
        positive === undefined ? "" : positive ? "positive" : "negative"
      }
    >
      <strong>
        {value === null
          ? "Rate needed"
          : formatProjectionMoney(value, currency)}
      </strong>
      <span>
        {label}
        {secondaryValue === null ? null : (
          <small>
            ≈ {formatProjectionMoney(secondaryValue, secondaryCurrency)}
          </small>
        )}
      </span>
    </div>
  );
}

function ProjectionMoneyPair({ amount, enteredCurrency, displayCurrency, usdIlsRate }: {
  amount: number;
  enteredCurrency: ProjectionCurrency;
  displayCurrency: ProjectionCurrency;
  usdIlsRate: number | null;
}) {
  const converted = convertProjectionAmount(
    amount,
    enteredCurrency,
    otherProjectionCurrency(enteredCurrency),
    usdIlsRate,
  );
  const displayValue = convertProjectionAmount(
    amount,
    enteredCurrency,
    displayCurrency,
    usdIlsRate,
  );
  const secondaryCurrency = otherProjectionCurrency(displayCurrency);
  const secondaryValue =
    displayValue === null
      ? null
      : secondaryCurrency === enteredCurrency
        ? amount
        : converted;
  return (
    <span className="projection-money-pair">
      <strong>
        {displayValue === null
          ? formatProjectionMoney(amount, enteredCurrency, true)
          : formatProjectionMoney(displayValue, displayCurrency, true)}
      </strong>
      {secondaryValue === null ? (
        <small>Exchange rate unavailable</small>
      ) : (
        <small>
          ≈ {formatProjectionMoney(secondaryValue, secondaryCurrency, true)}
        </small>
      )}
    </span>
  );
}

function ControlGroup({ label, className = "", children }: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`projection-control-group ${className}`}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function ProjectionEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="projection-empty-state">
      <span>
        <CalendarPlus size={26} />
      </span>
      <h2>Build your first projection</h2>
      <p>
        Add a bank and its first balance. These banks stay separate from the
        accounts used by your expenses and incomings.
      </p>
      <button
        type="button"
        className="projection-button primary"
        onClick={onAdd}
      >
        <Plus size={16} /> Add your first bank
      </button>
    </div>
  );
}

function ProjectionConfirmDialog({ state, saving, onCancel, onConfirm }: {
  state: Exclude<ConfirmState, null>;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="projection-confirm-backdrop"
      onMouseDown={saving ? undefined : onCancel}
    >
      <div
        className="projection-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>Delete {state.kind === "bank" ? "bank" : "balance"}?</h2>
        <p>
          {state.kind === "bank"
            ? `${state.title} and all of its balance history will be removed.`
            : `${state.title} will be removed from the chart history.`}
        </p>
        <div>
          <button
            type="button"
            className="projection-button secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="projection-button danger"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}