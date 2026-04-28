import { CloseIcon } from "../../../components/icons";
import type { Draft, EntryType } from "../types";

type EntryComposerProps = {
  availableAccounts: string[];
  availableCategories: string[];
  availableCounterparties: string[];
  availableExpenseKinds: string[];
  availableSubcategories: string[];
  closingComposer: EntryType | null;
  draft: Draft;
  isEditing: boolean;
  isEntrySaving: boolean;
  saveError: string | null;
  visibleComposer: EntryType;
  onClose: () => void;
  onDraftChange: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  onSave: () => void;
};

export function EntryComposer({
  availableAccounts,
  availableCategories,
  availableCounterparties,
  availableExpenseKinds,
  availableSubcategories,
  closingComposer,
  draft,
  isEditing,
  isEntrySaving,
  saveError,
  visibleComposer,
  onClose,
  onDraftChange,
  onSave,
}: EntryComposerProps) {
  const isExpense = visibleComposer === "expense";

  return (
    <div className="composer-shell" role="dialog" aria-modal="true">
      <button
        className={`composer-backdrop ${closingComposer ? "closing" : ""}`}
        onClick={onClose}
        type="button"
      />

      <div
        className={`composer-card ${visibleComposer} ${closingComposer ? "closing" : "opening"}`}
      >
        <div className="composer-header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? isExpense
                  ? "Edit expense"
                  : "Edit income"
                : isExpense
                  ? "Add expense"
                  : "Add income"}
            </p>
            <h3>
              {isEditing
                ? isExpense
                  ? "Update expense"
                  : "Update income"
                : isExpense
                  ? "New expense"
                  : "New income"}
            </h3>
          </div>
          <button className="close-button" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </div>

        {saveError ? (
          <div className="status-banner error inline">{saveError}</div>
        ) : null}

        <div className="composer-grid">
          <label className="full-width">
            Name
            <input
              onChange={(event) => onDraftChange("name", event.target.value)}
              placeholder="What was it?"
              value={draft.name}
            />
          </label>
          <label>
            Amount
            <input
              inputMode="decimal"
              onChange={(event) => onDraftChange("amount", event.target.value)}
              placeholder="0"
              value={draft.amount}
            />
          </label>
          <label>
            Date
            <input
              onChange={(event) => onDraftChange("date", event.target.value)}
              type="date"
              value={draft.date}
            />
          </label>
          {isExpense ? (
            <label>
              Expense type
              <select
                onChange={(event) =>
                  onDraftChange("entryKind", event.target.value)
                }
                value={draft.entryKind}
              >
                {availableExpenseKinds.map((entryKind) => (
                  <option key={entryKind} value={entryKind}>
                    {entryKind}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Paid by
              <input
                list="counterparty-options"
                onChange={(event) =>
                  onDraftChange("counterparty", event.target.value)
                }
                placeholder="Who paid you?"
                value={draft.counterparty}
              />
            </label>
          )}
          <label>
            Category
            <select
              onChange={(event) => {
                onDraftChange("category", event.target.value);
                onDraftChange("subcategory", "");
              }}
              value={draft.category}
            >
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sub-category
            <select
              onChange={(event) =>
                onDraftChange("subcategory", event.target.value)
              }
              value={draft.subcategory}
            >
              <option value="">None</option>
              {availableSubcategories.map((subcategory) => (
                <option key={subcategory} value={subcategory}>
                  {subcategory}
                </option>
              ))}
            </select>
          </label>
          <label>
            {isExpense ? "Paid to" : "Month allocation"}
            <input
              list="counterparty-options"
              onChange={(event) =>
                onDraftChange(
                  isExpense ? "counterparty" : "allocationMonthsText",
                  event.target.value,
                )
              }
              placeholder={isExpense ? "Optional" : "April 2026, May 2026"}
              value={
                isExpense ? draft.counterparty : draft.allocationMonthsText
              }
            />
            <datalist id="counterparty-options">
              {availableCounterparties.map((counterparty) => (
                <option key={counterparty} value={counterparty} />
              ))}
            </datalist>
          </label>
          <label>
            Account
            <select
              onChange={(event) => onDraftChange("account", event.target.value)}
              value={draft.account}
            >
              {availableAccounts.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Comments
            <textarea
              onChange={(event) =>
                onDraftChange("comments", event.target.value)
              }
              placeholder="Optional comments"
              rows={2}
              value={draft.comments}
            />
          </label>
          <label className="full-width">
            Notes
            <textarea
              onChange={(event) => onDraftChange("notes", event.target.value)}
              placeholder="Optional note"
              rows={3}
              value={draft.notes}
            />
          </label>
        </div>

        <div className="composer-actions">
          <button className="ghost-action" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={`save-action ${visibleComposer}`}
            disabled={isEntrySaving || Boolean(closingComposer)}
            onClick={onSave}
            type="button"
          >
            {isEntrySaving
              ? "Saving..."
              : isEditing
                ? "Save changes"
                : isExpense
                  ? "Save expense"
                  : "Save income"}
          </button>
        </div>
      </div>
    </div>
  );
}
