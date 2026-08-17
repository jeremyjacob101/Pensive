import { localIsoDate, projectionCurrencySymbol, resolvedProjectionCurrency } from "../helpers/projections";
import type { ProjectionBank, ProjectionBankDraft, ProjectionCurrency } from "../types/projections";
import { Check, Pipette, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

const BANK_COLORS = [
  "#153CF8",
  "#4389FF",
  "#FF6758",
  "#FB8B24",
  "#5EAE8C",
  "#8C62E3",
  "#27A9AE",
  "#74829A",
];

export function ProjectionBankSheet({ bank, saving, onClose, onSave }: {
  bank?: ProjectionBank;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ProjectionBankDraft) => Promise<void>;
}) {
  const initial = useMemo(
    () => ({
      name: bank?.name ?? "",
      color: bank?.color ?? BANK_COLORS[1],
      currency: resolvedProjectionCurrency(bank?.currency),
      interestEnabled: bank?.interestEnabled ?? false,
      annualInterestRate: String(bank?.annualInterestRate ?? ""),
      compounding: bank?.compounding ?? ("monthly" as const),
      startingBalance: "",
      startingDate: localIsoDate(),
      startingNote: "",
    }),
    [bank],
  );
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [currency, setCurrency] = useState<ProjectionCurrency>(
    initial.currency,
  );
  const [interestEnabled, setInterestEnabled] = useState(
    initial.interestEnabled,
  );
  const [annualRate, setAnnualRate] = useState(initial.annualInterestRate);
  const [compounding, setCompounding] = useState<"monthly" | "yearly">(
    initial.compounding,
  );
  const [startingBalance, setStartingBalance] = useState(
    initial.startingBalance,
  );
  const [startingDate, setStartingDate] = useState(initial.startingDate);
  const [startingNote, setStartingNote] = useState(initial.startingNote);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedRate = Number(annualRate || "0");
    const parsedBalance = startingBalance.trim()
      ? Number(startingBalance.replace(/,/g, ""))
      : undefined;
    if (!name.trim()) {
      setError("Give this bank a name.");
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      setError("Annual rate must be between 0 and 100.");
      return;
    }
    if (parsedBalance !== undefined && !Number.isFinite(parsedBalance)) {
      setError("Starting balance must be a valid number.");
      return;
    }
    setError("");
    await onSave({
      name: name.trim(),
      color,
      currency,
      interestEnabled,
      annualInterestRate: parsedRate,
      compounding,
      startingBalance: bank ? undefined : parsedBalance,
      startingDate:
        bank || parsedBalance === undefined ? undefined : startingDate,
      startingNote:
        bank || parsedBalance === undefined
          ? undefined
          : startingNote.trim() || undefined,
    });
  };

  return createPortal(
    <div
      className="projection-sheet-backdrop"
      onMouseDown={saving ? undefined : onClose}
    >
      <aside
        className="projection-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="projection-bank-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header className="projection-sheet-header">
            <h2 id="projection-bank-sheet-title">
              {bank ? "Edit bank" : "Add bank"}
            </h2>
            <button
              type="button"
              className="projection-icon-button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close bank editor"
            >
              <X size={19} />
            </button>
          </header>

          <div className="projection-sheet-body">
            <label className="projection-field">
              <span>Bank name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Savings"
              />
            </label>

            <fieldset className="projection-segment-fieldset">
              <legend>Bank currency</legend>
              <div className="projection-segmented projection-segmented-wide">
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
              <p className="projection-field-help">
                Used by default for new balance entries. Existing entries keep
                their saved currency.
              </p>
            </fieldset>

            <fieldset className="projection-color-fieldset">
              <legend>Color</legend>
              <div className="projection-color-swatches">
                {BANK_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`projection-color-swatch${color.toUpperCase() === option ? " selected" : ""}`}
                    style={{ backgroundColor: option }}
                    onClick={() => setColor(option)}
                    aria-label={`Use color ${option}`}
                    aria-pressed={color.toUpperCase() === option}
                  >
                    {color.toUpperCase() === option ? (
                      <Check size={14} />
                    ) : null}
                  </button>
                ))}
              </div>
              <label className="projection-custom-color">
                <span style={{ backgroundColor: color }} />
                <code>{color.toUpperCase()}</code>
                <Pipette size={15} aria-hidden="true" />
                <input
                  type="color"
                  value={color}
                  onChange={(event) =>
                    setColor(event.target.value.toUpperCase())
                  }
                  aria-label="Custom bank color"
                />
              </label>
            </fieldset>

            <label className="projection-switch-row">
              <span>
                <strong>Project interest</strong>
                <small>Grow this bank beyond its latest balance.</small>
              </span>
              <input
                type="checkbox"
                checked={interestEnabled}
                onChange={(event) => setInterestEnabled(event.target.checked)}
              />
            </label>

            <label className="projection-field">
              <span>Annual rate</span>
              <span className="projection-input-suffix">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  value={annualRate}
                  onChange={(event) => setAnnualRate(event.target.value)}
                  disabled={!interestEnabled}
                />
                <i>%</i>
              </span>
            </label>

            <fieldset
              className="projection-segment-fieldset"
              disabled={!interestEnabled}
            >
              <legend>Compounding</legend>
              <div className="projection-segmented projection-segmented-wide">
                {(["monthly", "yearly"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={compounding === option ? "active" : ""}
                    onClick={() => setCompounding(option)}
                  >
                    {option[0].toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>

            {!bank ? (
              <section className="projection-starting-balance">
                <h3>Starting balance</h3>
                <label className="projection-field">
                  <span>Amount</span>
                  <span className="projection-input-prefix">
                    <i>{projectionCurrencySymbol(currency)}</i>
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={startingBalance}
                      onChange={(event) =>
                        setStartingBalance(event.target.value)
                      }
                      placeholder="0.00"
                    />
                  </span>
                </label>
                <label className="projection-field">
                  <span>As of date</span>
                  <input
                    type="date"
                    value={startingDate}
                    onChange={(event) => setStartingDate(event.target.value)}
                    disabled={!startingBalance.trim()}
                  />
                </label>
                <label className="projection-field">
                  <span>
                    Note <small>(optional)</small>
                  </span>
                  <input
                    value={startingNote}
                    maxLength={240}
                    onChange={(event) => setStartingNote(event.target.value)}
                    placeholder="What changed?"
                    disabled={!startingBalance.trim()}
                  />
                </label>
                <p>This creates the bank’s first balance entry.</p>
              </section>
            ) : null}

            {error ? (
              <p className="projection-form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="projection-sheet-footer">
            <button
              type="button"
              className="projection-button secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="projection-button primary"
              disabled={saving}
            >
              {saving ? "Saving…" : bank ? "Save changes" : "Add bank"}
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}