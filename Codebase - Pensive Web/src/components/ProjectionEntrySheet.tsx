import type { ProjectionBank, ProjectionCurrency, ProjectionEntry, ProjectionEntryDraft } from "../types/projections";
import { localIsoDate, projectionCurrencySymbol, resolvedProjectionCurrency } from "../helpers/projections";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useState } from "react";

export function ProjectionEntrySheet({ banks, entry, initialBankId, saving, onClose, onSave }: {
  banks: ProjectionBank[];
  entry?: ProjectionEntry;
  initialBankId?: ProjectionBank["_id"];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ProjectionEntryDraft) => Promise<void>;
}) {
  const [bankId, setBankId] = useState(
    entry?.bankId ?? initialBankId ?? banks[0]?._id,
  );
  const initialBank =
    banks.find((bank) => bank._id === (entry?.bankId ?? initialBankId)) ??
    banks[0];
  const [currency, setCurrency] = useState<ProjectionCurrency>(
    entry
      ? resolvedProjectionCurrency(entry.currency)
      : resolvedProjectionCurrency(initialBank?.currency),
  );
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [date, setDate] = useState(entry?.date ?? localIsoDate());
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(/,/g, ""));
    if (!bankId) {
      setError("Choose a bank.");
      return;
    }
    if (!amount.trim() || !Number.isFinite(parsedAmount)) {
      setError("Enter a valid balance.");
      return;
    }
    if (!date) {
      setError("Choose the balance date.");
      return;
    }
    setError("");
    await onSave({
      bankId,
      amount: parsedAmount,
      currency,
      date,
      note: note.trim() || undefined,
    });
  };

  return createPortal(
    <div
      className="projection-sheet-backdrop"
      onMouseDown={saving ? undefined : onClose}
    >
      <aside
        className="projection-sheet projection-entry-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="projection-entry-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={(event) => void submit(event)}>
          <header className="projection-sheet-header">
            <div>
              <h2 id="projection-entry-sheet-title">
                {entry ? "Edit balance" : "Add balance"}
              </h2>
              <p>Record the amount you had in a bank on a specific date.</p>
            </div>
            <button
              type="button"
              className="projection-icon-button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close balance editor"
            >
              <X size={19} />
            </button>
          </header>

          <div className="projection-sheet-body">
            <label className="projection-field">
              <span>Bank</span>
              <select
                autoFocus
                value={bankId ?? ""}
                onChange={(event) => {
                  const nextId = event.target.value as ProjectionBank["_id"];
                  setBankId(nextId);
                  if (!entry) {
                    const nextBank = banks.find((bank) => bank._id === nextId);
                    setCurrency(resolvedProjectionCurrency(nextBank?.currency));
                  }
                }}
              >
                {banks.map((bank) => (
                  <option key={bank._id} value={bank._id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="projection-segment-fieldset">
              <legend>Entry currency</legend>
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
            </fieldset>
            <label className="projection-field">
              <span>Balance</span>
              <span className="projection-input-prefix">
                <i>{projectionCurrencySymbol(currency)}</i>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                />
              </span>
            </label>
            <label className="projection-field">
              <span>As of date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="projection-field">
              <span>
                Note <small>(optional)</small>
              </span>
              <textarea
                value={note}
                maxLength={240}
                rows={3}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What changed?"
              />
            </label>
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
              disabled={saving || banks.length === 0}
            >
              {saving ? "Saving…" : entry ? "Save changes" : "Add balance"}
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
}