import type { SavingsCurrency, SavingsCurrencySettings } from "../types/savings";
import { formatSavingsDate } from "../helpers/savings";
import { RefreshCw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useState } from "react";

export function SavingsCurrencySheet({ settings, displayCurrency, saving, refreshing, onClose, onRefresh, onSave }: {
  settings: SavingsCurrencySettings;
  displayCurrency: SavingsCurrency;
  saving: boolean;
  refreshing: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSave: (
    displayCurrency: SavingsCurrency,
    manualUsdIlsRate: number | null,
  ) => Promise<void>;
}) {
  const [currency, setCurrency] = useState(displayCurrency);
  const [rateMode, setRateMode] = useState<"live" | "custom">(
    settings.manualUsdIlsRate === null ? "live" : "custom",
  );
  const [manualRate, setManualRate] = useState(
    settings.manualUsdIlsRate?.toString() ??
      settings.liveUsdIlsRate?.toString() ??
      "",
  );
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(manualRate);
    if (
      rateMode === "custom" &&
      (!manualRate.trim() ||
        !Number.isFinite(parsed) ||
        parsed <= 0 ||
        parsed > 100)
    ) {
      setError("Enter a USD to ILS rate greater than 0 and no more than 100.");
      return;
    }
    setError("");
    await onSave(currency, rateMode === "custom" ? parsed : null);
  };

  return createPortal(
    <div
      className="savings-sheet-backdrop"
      onMouseDown={saving || refreshing ? undefined : onClose}
    >
      <aside
        className="savings-sheet savings-currency-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savings-currency-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header className="savings-sheet-header">
            <div>
              <h2 id="savings-currency-sheet-title">Currency & rate</h2>
              <p>Choose how every savings total is displayed.</p>
            </div>
            <button
              type="button"
              className="savings-icon-button"
              onClick={onClose}
              disabled={saving || refreshing}
              aria-label="Close currency settings"
            >
              <X size={19} />
            </button>
          </header>

          <div className="savings-sheet-body">
            <fieldset className="savings-segment-fieldset">
              <legend>Display currency</legend>
              <div className="savings-segmented savings-segmented-wide">
                {(["ILS", "USD"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={currency === option ? "active" : ""}
                    onClick={() => setCurrency(option)}
                  >
                    {option === "ILS" ? "₪ ILS" : "$ USD"}
                  </button>
                ))}
              </div>
            </fieldset>

            <section className="savings-live-rate-card">
              <div>
                <span>Live USD → ILS</span>
                <strong>
                  {settings.liveUsdIlsRate
                    ? `1 USD = ₪${settings.liveUsdIlsRate.toFixed(4)}`
                    : "No live rate cached yet"}
                </strong>
                <small>
                  {settings.liveRateDate
                    ? `${settings.rateSource} · ${formatSavingsDate(settings.liveRateDate)}`
                    : `${settings.rateSource} · daily reference rate`}
                </small>
              </div>
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={refreshing || saving}
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "savings-spinning" : ""}
                />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </section>

            <fieldset className="savings-segment-fieldset">
              <legend>Rate used for savings</legend>
              <div className="savings-segmented savings-segmented-wide">
                <button
                  type="button"
                  className={rateMode === "live" ? "active" : ""}
                  onClick={() => setRateMode("live")}
                >
                  Live rate
                </button>
                <button
                  type="button"
                  className={rateMode === "custom" ? "active" : ""}
                  onClick={() => setRateMode("custom")}
                >
                  Custom rate
                </button>
              </div>
            </fieldset>

            {rateMode === "custom" ? (
              <label className="savings-field">
                <span>ILS for 1 USD</span>
                <span className="savings-input-prefix">
                  <i>₪</i>
                  <input
                    autoFocus
                    type="number"
                    min="0.0001"
                    max="100"
                    step="0.0001"
                    inputMode="decimal"
                    value={manualRate}
                    onChange={(event) => setManualRate(event.target.value)}
                    placeholder="3.0000"
                  />
                </span>
              </label>
            ) : null}

            <p className="savings-currency-explainer">
              Your entries keep the currency and amount you originally saved.
              Changing this rate only changes conversions, totals, and the
              chart.
            </p>

            {error ? (
              <p className="savings-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="savings-sheet-footer">
            <button
              type="button"
              className="savings-button secondary"
              onClick={onClose}
              disabled={saving || refreshing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="savings-button primary"
              disabled={saving || refreshing}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}