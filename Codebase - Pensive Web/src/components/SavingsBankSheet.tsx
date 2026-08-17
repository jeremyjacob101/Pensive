import { localIsoDate, savingsCurrencySymbol, resolvedSavingsCurrency } from "../helpers/savings";
import type { SavingsBank, SavingsBankDraft, SavingsCurrency } from "../types/savings";
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

export function SavingsBankSheet({ bank, saving, onClose, onSave }: {
  bank?: SavingsBank;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: SavingsBankDraft) => Promise<void>;
}) {
  const initial = useMemo(
    () => ({
      name: bank?.name ?? "",
      color: bank?.color ?? BANK_COLORS[1],
      currency: resolvedSavingsCurrency(bank?.currency),
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
  const [currency, setCurrency] = useState<SavingsCurrency>(initial.currency);
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
      className="savings-sheet-backdrop"
      onMouseDown={saving ? undefined : onClose}
    >
      <aside
        className="savings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savings-bank-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header className="savings-sheet-header">
            <h2 id="savings-bank-sheet-title">
              {bank ? "Edit bank" : "Add bank"}
            </h2>
            <button
              type="button"
              className="savings-icon-button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close bank editor"
            >
              <X size={19} />
            </button>
          </header>

          <div className="savings-sheet-body">
            <label className="savings-field">
              <span>Bank name</span>
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Savings"
              />
            </label>

            <fieldset className="savings-segment-fieldset">
              <legend>Bank currency</legend>
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
              <p className="savings-field-help">
                Used by default for new balance entries. Existing entries keep
                their saved currency.
              </p>
            </fieldset>

            <fieldset className="savings-color-fieldset">
              <legend>Color</legend>
              <div className="savings-color-swatches">
                {BANK_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`savings-color-swatch${color.toUpperCase() === option ? " selected" : ""}`}
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
              <label className="savings-custom-color">
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

            <label className="savings-switch-row">
              <span>
                <strong>Grow with interest</strong>
                <small>Grow this bank beyond its latest balance.</small>
              </span>
              <input
                type="checkbox"
                checked={interestEnabled}
                onChange={(event) => setInterestEnabled(event.target.checked)}
              />
            </label>

            <label className="savings-field">
              <span>Annual rate</span>
              <span className="savings-input-suffix">
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
              className="savings-segment-fieldset"
              disabled={!interestEnabled}
            >
              <legend>Compounding</legend>
              <div className="savings-segmented savings-segmented-wide">
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
              <section className="savings-starting-balance">
                <h3>Starting balance</h3>
                <label className="savings-field">
                  <span>Amount</span>
                  <span className="savings-input-prefix">
                    <i>{savingsCurrencySymbol(currency)}</i>
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
                <label className="savings-field">
                  <span>As of date</span>
                  <input
                    type="date"
                    value={startingDate}
                    onChange={(event) => setStartingDate(event.target.value)}
                    disabled={!startingBalance.trim()}
                  />
                </label>
                <label className="savings-field">
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
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="savings-button primary"
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