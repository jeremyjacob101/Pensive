import { useState } from "react";
import { EditIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { pluralize } from "../utils";
import type {
  BillReference,
  DefaultAccount,
  DefaultCategory,
  DefaultExpenseKind,
  DefaultSubcategory,
  DefaultsOverview,
  EntryType,
  ImportantDate,
} from "../types";

type DefaultsPageProps = {
  activeDefaultsTab: EntryType;
  defaultsError: string | null;
  defaultsMessage: string | null;
  defaultsOverview: DefaultsOverview;
  onActiveDefaultsTabChange: (type: EntryType) => void;
  onAddAccount: () => void;
  onAddBill: () => void;
  onAddCategory: (type: EntryType) => void;
  onAddExpenseKind: () => void;
  onAddImportantDate: () => void;
  onAddSubcategory: (category: DefaultCategory) => void;
  onClose: () => void;
  onDeleteAccount: (account: DefaultAccount) => void;
  onDeleteBill: (bill: BillReference) => void;
  onDeleteCategory: (category: DefaultCategory) => void;
  onDeleteExpenseKind: (kind: DefaultExpenseKind) => void;
  onDeleteImportantDate: (item: ImportantDate) => void;
  onDeleteSubcategory: (
    category: DefaultCategory,
    subcategory: DefaultSubcategory,
  ) => void;
  onEditBill: (bill: BillReference) => void;
  onRenameAccount: (account: DefaultAccount) => void;
  onRenameCategory: (category: DefaultCategory) => void;
  onRenameExpenseKind: (kind: DefaultExpenseKind) => void;
  onRenameImportantDate: (item: ImportantDate) => void;
  onRenameSubcategory: (
    category: DefaultCategory,
    subcategory: DefaultSubcategory,
  ) => void;
  onSaveNotepad: (content: string) => void;
};

function NotepadEditor({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (content: string) => void;
}) {
  const [draft, setDraft] = useState(initialValue);

  return (
    <div className="notepad-shell">
      <textarea
        className="notepad-editor"
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Keep running notes, reminders, settlement math, and bill references here."
        rows={14}
        value={draft}
      />
      <div className="inline-form-actions">
        <button
          className="ghost-action"
          onClick={() => setDraft(initialValue)}
          type="button"
        >
          Reset
        </button>
        <button
          className="save-action account"
          onClick={() => onSave(draft)}
          type="button"
        >
          Save notepad
        </button>
      </div>
    </div>
  );
}

export function DefaultsPage({
  activeDefaultsTab,
  defaultsError,
  defaultsMessage,
  defaultsOverview,
  onActiveDefaultsTabChange,
  onAddAccount,
  onAddBill,
  onAddCategory,
  onAddExpenseKind,
  onAddImportantDate,
  onAddSubcategory,
  onClose,
  onDeleteAccount,
  onDeleteBill,
  onDeleteCategory,
  onDeleteExpenseKind,
  onDeleteImportantDate,
  onDeleteSubcategory,
  onEditBill,
  onRenameAccount,
  onRenameCategory,
  onRenameExpenseKind,
  onRenameImportantDate,
  onRenameSubcategory,
  onSaveNotepad,
}: DefaultsPageProps) {
  const visibleDefaultCategories =
    defaultsOverview.categories[activeDefaultsTab];

  return (
    <section className="settings-page">
      <div className="settings-page-header">
        <div>
          <p className="eyebrow">Customize</p>
          <h2>Manage lists</h2>
        </div>
        <button className="ghost-action" onClick={onClose} type="button">
          Back to dashboard
        </button>
      </div>

      {defaultsError ? (
        <div className="status-banner error">{defaultsError}</div>
      ) : null}
      {defaultsMessage ? (
        <div className="status-banner success">{defaultsMessage}</div>
      ) : null}

      <div className="settings-columns">
        <section className="settings-section list-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Accounts</p>
              <h3>Accounts</h3>
            </div>
          </div>

          <div className="settings-list dense-list">
            {defaultsOverview.accounts.map((account) => (
              <div className="manage-row" key={account.id}>
                <div className="manage-copy">
                  <strong>{account.name}</strong>
                  <span>{pluralize("entry", account.usageCount)}</span>
                </div>
                <div className="manage-actions">
                  <button
                    aria-label={`Edit ${account.name}`}
                    className="icon-action edit"
                    onClick={() => onRenameAccount(account)}
                    type="button"
                  >
                    <EditIcon />
                  </button>
                  <button
                    aria-label={`Delete ${account.name}`}
                    className="icon-action danger"
                    onClick={() => onDeleteAccount(account)}
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}

            <button className="create-row" onClick={onAddAccount} type="button">
              <PlusIcon />
              Add account
            </button>
          </div>
        </section>

        <section className="settings-section list-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Categories</p>
              <h3>Categories</h3>
            </div>
            <div className="segmented-control">
              <button
                className={activeDefaultsTab === "expense" ? "active" : ""}
                onClick={() => onActiveDefaultsTabChange("expense")}
                type="button"
              >
                Expense
              </button>
              <button
                className={activeDefaultsTab === "income" ? "active" : ""}
                onClick={() => onActiveDefaultsTabChange("income")}
                type="button"
              >
                Income
              </button>
            </div>
          </div>

          <div className="settings-list category-grid">
            {visibleDefaultCategories.map((category) => (
              <div className="category-group" key={category.id}>
                <div className="manage-row">
                  <div className="manage-copy">
                    <strong>{category.name}</strong>
                    <span>
                      {pluralize("entry", category.usageCount)} ·{" "}
                      {pluralize("sub-category", category.subcategories.length)}
                    </span>
                  </div>
                  <div className="manage-actions">
                    <button
                      aria-label={`Edit ${category.name}`}
                      className="icon-action edit"
                      onClick={() => onRenameCategory(category)}
                      type="button"
                    >
                      <EditIcon />
                    </button>
                    <button
                      aria-label={`Delete ${category.name}`}
                      className="icon-action danger"
                      onClick={() => onDeleteCategory(category)}
                      type="button"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <div className="subcategory-stack">
                  {category.subcategories.map((subcategory) => (
                    <div className="manage-row sub-row" key={subcategory.id}>
                      <div className="manage-copy">
                        <strong>{subcategory.name}</strong>
                        <span>
                          {pluralize("entry", subcategory.usageCount)}
                        </span>
                      </div>
                      <div className="manage-actions">
                        <button
                          aria-label={`Edit ${subcategory.name}`}
                          className="icon-action edit"
                          onClick={() =>
                            onRenameSubcategory(category, subcategory)
                          }
                          type="button"
                        >
                          <EditIcon />
                        </button>
                        <button
                          aria-label={`Delete ${subcategory.name}`}
                          className="icon-action danger"
                          onClick={() =>
                            onDeleteSubcategory(category, subcategory)
                          }
                          type="button"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    className="create-row sub-row"
                    onClick={() => onAddSubcategory(category)}
                    type="button"
                  >
                    <PlusIcon />
                    Add sub-category
                  </button>
                </div>
              </div>
            ))}

            <button
              className="create-row"
              onClick={() => onAddCategory(activeDefaultsTab)}
              type="button"
            >
              <PlusIcon />
              Add {activeDefaultsTab}
            </button>
          </div>
        </section>
      </div>

      <div className="settings-columns secondary-settings-columns">
        <section className="settings-section list-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Expense types</p>
              <h3>Expense kinds</h3>
            </div>
          </div>

          <div className="settings-list dense-list">
            {defaultsOverview.expenseKinds.map((kind) => (
              <div className="manage-row" key={kind.id}>
                <div className="manage-copy">
                  <strong>{kind.name}</strong>
                  <span>{pluralize("entry", kind.usageCount)}</span>
                </div>
                <div className="manage-actions">
                  <button
                    aria-label={`Edit ${kind.name}`}
                    className="icon-action edit"
                    onClick={() => onRenameExpenseKind(kind)}
                    type="button"
                  >
                    <EditIcon />
                  </button>
                  <button
                    aria-label={`Delete ${kind.name}`}
                    className="icon-action danger"
                    onClick={() => onDeleteExpenseKind(kind)}
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="create-row"
              onClick={onAddExpenseKind}
              type="button"
            >
              <PlusIcon />
              Add expense kind
            </button>
          </div>
        </section>

        <section className="settings-section list-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Bills</p>
              <h3>Bills</h3>
            </div>
          </div>

          <div className="settings-list dense-list">
            {defaultsOverview.bills.map((bill) => (
              <div className="manage-row bill-row" key={bill.id}>
                <div className="manage-copy">
                  <strong>{bill.name}</strong>
                  <span>
                    {[
                      bill.customerNumber
                        ? `Customer ${bill.customerNumber}`
                        : null,
                      bill.consumerNumber
                        ? `Consumer ${bill.consumerNumber}`
                        : null,
                      bill.meterNumber ? `Meter ${bill.meterNumber}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Bill details"}
                  </span>
                  {bill.contractAccount || bill.identityNumber || bill.notes ? (
                    <span>
                      {[
                        bill.contractAccount
                          ? `Contract ${bill.contractAccount}`
                          : null,
                        bill.identityNumber
                          ? `ID ${bill.identityNumber}`
                          : null,
                        bill.notes,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </div>
                <div className="manage-actions">
                  <button
                    aria-label={`Edit ${bill.name}`}
                    className="icon-action edit"
                    onClick={() => onEditBill(bill)}
                    type="button"
                  >
                    <EditIcon />
                  </button>
                  <button
                    aria-label={`Delete ${bill.name}`}
                    className="icon-action danger"
                    onClick={() => onDeleteBill(bill)}
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}

            <button className="create-row" onClick={onAddBill} type="button">
              <PlusIcon />
              Add bill
            </button>
          </div>
        </section>
      </div>

      <div className="settings-columns secondary-settings-columns">
        <section className="settings-section list-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dates</p>
              <h3>Important dates</h3>
            </div>
          </div>

          <div className="settings-list dense-list">
            {defaultsOverview.importantDates.map((item) => (
              <div className="manage-row" key={item.id}>
                <div className="manage-copy">
                  <strong>{item.name}</strong>
                  <span>{item.date}</span>
                </div>
                <div className="manage-actions">
                  <button
                    aria-label={`Edit ${item.name}`}
                    className="icon-action edit"
                    onClick={() => onRenameImportantDate(item)}
                    type="button"
                  >
                    <EditIcon />
                  </button>
                  <button
                    aria-label={`Delete ${item.name}`}
                    className="icon-action danger"
                    onClick={() => onDeleteImportantDate(item)}
                    type="button"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}

            <button
              className="create-row"
              onClick={onAddImportantDate}
              type="button"
            >
              <PlusIcon />
              Add important date
            </button>
          </div>
        </section>
      </div>

      <section className="settings-section panel notepad-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Notepad</p>
            <h3>Notes</h3>
          </div>
          <span className="panel-meta">
            {defaultsOverview.notepad.updatedAt
              ? `Updated ${new Date(defaultsOverview.notepad.updatedAt).toLocaleString()}`
              : "No saved note yet"}
          </span>
        </div>

        <NotepadEditor
          initialValue={defaultsOverview.notepad.content}
          key={
            defaultsOverview.notepad.updatedAt ??
            defaultsOverview.notepad.content
          }
          onSave={onSaveNotepad}
        />
      </section>
    </section>
  );
}
