import { handleDeleteRecurring, handleStartEditRecurring, handleUpdateRecurring } from "./actions";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { EditableRowActions } from "../components/EditableRowActions";
import { getOptionColor, toOptionValues } from "../helpers/options";
import type { WorkspaceMutations } from "../types/workspaceActions";
import type { UserOptions, EditValues } from "../types/workspace";
import { useAutoLoadMore } from "../hooks/useAutoLoadMore";
import { OptionPicker } from "../components/OptionPicker";
import { CreditCard, Plus, Repeat } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { formatOrdinalDay } from "../helpers/dates";
import { api } from "../../convex/_generated/api";
import { saveOption } from "./actions";
import { useState } from "react";

export function Recurrings() {
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(
    null,
  );
  const [expandedRecurringId, setExpandedRecurringId] = useState<string | null>(
    null,
  );
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);
  const [togglingRecurringId, setTogglingRecurringId] = useState<string | null>(
    null,
  );

  const updateRecurring = useMutation(api.recurrings.update);
  const setRecurringStatus = useMutation(api.recurrings.setStatus);
  const deleteRecurring = useMutation(api.recurrings.remove);
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);

  const {
    results: recurrings,
    status: recurringsStatus,
    loadMore: loadMoreRecurrings,
  } = usePaginatedQuery(api.recurrings.list, {}, { initialNumItems: 50 });
  useAutoLoadMore(recurringsStatus, () => loadMoreRecurrings(50));

  const expenseRecurrings = recurrings.filter(
    (row) => (row.kind ?? "expense") === "expense",
  );
  const incomingRecurrings = recurrings.filter(
    (row) => row.kind === "incoming",
  );

  return (
    <>
      {recurrings.length === 0 ? (
        <p>No recurrings yet.</p>
      ) : (
        <div className="entries-without-month recurrings-columns">
          <section className="recurrings-column">
            <div className="recurrings-column-header">
              <h3 className="recurrings-column-title">Recurring Expenses</h3>
              <button
                type="button"
                className="recurrings-column-add-btn"
                aria-label="Add recurring expense"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("pensive:open-recurring-modal", {
                      detail: { kind: "expense" },
                    }),
                  )
                }
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="entry-card-list">
              {expenseRecurrings.length === 0 ? (
                <p className="recurrings-empty">No recurring expenses yet.</p>
              ) : (
                expenseRecurrings.map((row) => {
                  const isExpanded = expandedRecurringId === row._id;
                  const isEditing = editingRecurringId === row._id;
                  const categoryColor = getOptionColor(
                    userOptions,
                    "category",
                    row.expenseCategory ?? row.category ?? "",
                  );
                  const accountColor = getOptionColor(
                    userOptions,
                    "account",
                    row.expenseAccount ?? row.paidBy ?? "",
                  );
                  const isActive = row.status.toLowerCase() === "active";
                  const isToggling = togglingRecurringId === row._id;

                  return (
                    <div
                      key={row._id}
                      className={`entry-card recurring-entry-card${
                        isExpanded ? " is-expanded" : ""
                      }${isActive ? "" : " is-inactive"}`}
                    >
                      <div className="entry-card-main recurring-entry-card-main">
                        <div className="recurring-status-toggle-wrap">
                          <input
                            type="checkbox"
                            className="recurring-status-toggle"
                            checked={isActive}
                            disabled={isToggling}
                            aria-label={
                              isActive
                                ? `Set ${row.name} as inactive`
                                : `Set ${row.name} as active`
                            }
                            onChange={() => {
                              const nextStatus = isActive
                                ? "inactive"
                                : "active";
                              setTogglingRecurringId(row._id);
                              void setRecurringStatus({
                                id: row._id,
                                status: nextStatus,
                              }).finally(() => setTogglingRecurringId(null));
                            }}
                          />
                        </div>
                        <div className="entry-card-primary">
                          <div className="entry-card-amount">
                            <CreditCard
                              className="entry-card-account-icon"
                              style={{ color: accountColor }}
                              aria-hidden="true"
                            />
                            <span>₪{row.price}</span>
                          </div>
                          <span
                            className="entry-card-primary-divider"
                            aria-hidden="true"
                          />
                          <div className="entry-card-title-wrap">
                            <span className="entry-card-title">{row.name}</span>
                            <span
                              className="entry-card-color-dot"
                              style={{ backgroundColor: categoryColor }}
                            />
                          </div>
                        </div>
                        <div className="entry-card-date recurring-cycle-date">
                          <Repeat
                            className="entry-card-account-icon"
                            aria-hidden="true"
                          />{" "}
                          {formatOrdinalDay(row.dayOfMonth)}
                        </div>
                        <div className="entry-row-controls">
                          <EditableRowActions
                            isEditing={false}
                            saving={saving}
                            onSave={() => {}}
                            onCancel={() => {}}
                            onEdit={() =>
                              handleStartEditRecurring(
                                row,
                                setEditingRecurringId,
                                setEditValues,
                              )
                            }
                            onDelete={() =>
                              handleDeleteRecurring(
                                row,
                                deleteRecurring,
                                setSaving,
                              )
                            }
                          />
                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() =>
                              setExpandedRecurringId((prev) =>
                                prev === row._id ? null : row._id)
                            }
                          >
                            {isExpanded ? "▴" : "▾"}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="entry-card-details">
                          <div className="entry-detail-grid static">
                            <div>
                              <strong>Kind:</strong> expense
                            </div>
                            <div>
                              <strong>Status:</strong>{" "}
                              {isActive ? "active" : "inactive"}
                            </div>
                            <div>
                              <strong>Frequency:</strong> {row.frequency}
                            </div>
                            <div>
                              <strong>Type:</strong>{" "}
                              {row.expenseType ?? row.type ?? "-"}
                            </div>
                            <div>
                              <strong>Account:</strong>{" "}
                              {row.expenseAccount ?? row.paidBy ?? "-"}
                            </div>
                            <div>
                              <strong>Category:</strong>{" "}
                              {row.expenseCategory ?? row.category ?? "-"}
                            </div>
                            <div>
                              <strong>Paid To:</strong>{" "}
                              {row.expensePaidTo ?? row.paidTo ?? "-"}
                            </div>
                            <div>
                              <strong>Notes:</strong> {row.notes ?? "-"}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <RecurringEditModal
                          editValues={editValues}
                          setEditValues={setEditValues}
                          userOptions={userOptions}
                          addUserOption={addUserOption}
                          saving={saving}
                          onClose={() => setEditingRecurringId(null)}
                          onSave={() =>
                            handleUpdateRecurring(row, {
                              updateRecurring,
                              editValues,
                              setSaving,
                              setEditingRecurringId,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="recurrings-column">
            <div className="recurrings-column-header">
              <h3 className="recurrings-column-title">Recurring Incomings</h3>
              <button
                type="button"
                className="recurrings-column-add-btn"
                aria-label="Add recurring incoming"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("pensive:open-recurring-modal", {
                      detail: { kind: "incoming" },
                    }),
                  )
                }
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="entry-card-list">
              {incomingRecurrings.length === 0 ? (
                <p className="recurrings-empty">No recurring incomings yet.</p>
              ) : (
                incomingRecurrings.map((row) => {
                  const isExpanded = expandedRecurringId === row._id;
                  const isEditing = editingRecurringId === row._id;
                  const categoryColor = getOptionColor(
                    userOptions,
                    "incomeType",
                    row.incomingType ?? "",
                  );
                  const accountColor = getOptionColor(
                    userOptions,
                    "account",
                    row.incomingAccount ?? row.paidTo ?? "",
                  );
                  const isActive = row.status.toLowerCase() === "active";
                  const isToggling = togglingRecurringId === row._id;

                  return (
                    <div
                      key={row._id}
                      className={`entry-card recurring-entry-card${
                        isExpanded ? " is-expanded" : ""
                      }${isActive ? "" : " is-inactive"}`}
                    >
                      <div className="entry-card-main recurring-entry-card-main">
                        <div className="recurring-status-toggle-wrap">
                          <input
                            type="checkbox"
                            className="recurring-status-toggle"
                            checked={isActive}
                            disabled={isToggling}
                            aria-label={
                              isActive
                                ? `Set ${row.name} as inactive`
                                : `Set ${row.name} as active`
                            }
                            onChange={() => {
                              const nextStatus = isActive
                                ? "inactive"
                                : "active";
                              setTogglingRecurringId(row._id);
                              void setRecurringStatus({
                                id: row._id,
                                status: nextStatus,
                              }).finally(() => setTogglingRecurringId(null));
                            }}
                          />
                        </div>
                        <div className="entry-card-primary">
                          <div className="entry-card-amount">
                            <CreditCard
                              className="entry-card-account-icon"
                              style={{ color: accountColor }}
                              aria-hidden="true"
                            />
                            <span>₪{row.price}</span>
                          </div>
                          <span
                            className="entry-card-primary-divider"
                            aria-hidden="true"
                          />
                          <div className="entry-card-title-wrap">
                            <span className="entry-card-title">{row.name}</span>
                            <span
                              className="entry-card-color-dot"
                              style={{ backgroundColor: categoryColor }}
                            />
                          </div>
                        </div>
                        <div className="entry-card-date recurring-cycle-date">
                          <Repeat
                            className="entry-card-account-icon"
                            aria-hidden="true"
                          />{" "}
                          {formatOrdinalDay(row.dayOfMonth)}
                        </div>
                        <div className="entry-row-controls">
                          <EditableRowActions
                            isEditing={false}
                            saving={saving}
                            onSave={() => {}}
                            onCancel={() => {}}
                            onEdit={() =>
                              handleStartEditRecurring(
                                row,
                                setEditingRecurringId,
                                setEditValues,
                              )
                            }
                            onDelete={() =>
                              handleDeleteRecurring(
                                row,
                                deleteRecurring,
                                setSaving,
                              )
                            }
                          />
                          <button
                            type="button"
                            className="icon-action-btn"
                            onClick={() =>
                              setExpandedRecurringId((prev) =>
                                prev === row._id ? null : row._id)
                            }
                          >
                            {isExpanded ? "▴" : "▾"}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="entry-card-details">
                          <div className="entry-detail-grid static">
                            <div>
                              <strong>Kind:</strong> incoming
                            </div>
                            <div>
                              <strong>Status:</strong>{" "}
                              {isActive ? "active" : "inactive"}
                            </div>
                            <div>
                              <strong>Frequency:</strong> {row.frequency}
                            </div>
                            <div>
                              <strong>Paid By:</strong>{" "}
                              {row.incomingPaidBy ?? row.paidBy ?? "-"}
                            </div>
                            <div>
                              <strong>Income Type:</strong>{" "}
                              {row.incomingType ?? "-"}
                            </div>
                            <div>
                              <strong>Account:</strong>{" "}
                              {row.incomingAccount ?? row.paidTo ?? "-"}
                            </div>
                            <div>
                              <strong>Notes:</strong> {row.notes ?? "-"}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <RecurringEditModal
                          editValues={editValues}
                          setEditValues={setEditValues}
                          userOptions={userOptions}
                          addUserOption={addUserOption}
                          saving={saving}
                          onClose={() => setEditingRecurringId(null)}
                          onSave={() =>
                            handleUpdateRecurring(row, {
                              updateRecurring,
                              editValues,
                              setSaving,
                              setEditingRecurringId,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function RecurringEditModal({ editValues, setEditValues, userOptions, addUserOption, saving, onClose, onSave }: {
  editValues: EditValues;
  setEditValues: Dispatch<SetStateAction<EditValues>>;
  userOptions: UserOptions | undefined;
  addUserOption: WorkspaceMutations["addUserOption"];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Recurring</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="entry-form modal-form">
          <label>
            Kind
            <select
              value={editValues.kind ?? "expense"}
              onChange={(e) =>
                setEditValues((v) => ({
                  ...v,
                  kind: e.target.value === "incoming" ? "incoming" : "expense",
                }))
              }
            >
              <option value="expense">Expense</option>
              <option value="incoming">Incoming</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={editValues.status ?? "active"}
              onChange={(e) =>
                setEditValues((v) => ({
                  ...v,
                  status: e.target.value === "inactive" ? "inactive" : "active",
                }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <input
            value={editValues.name ?? ""}
            onChange={(e) =>
              setEditValues((v) => ({
                ...v,
                name: e.target.value,
              }))
            }
          />
          <input
            value={editValues.price ?? ""}
            onChange={(e) =>
              setEditValues((v) => ({
                ...v,
                price: e.target.value,
              }))
            }
          />
          <input
            value={editValues.frequency ?? ""}
            onChange={(e) =>
              setEditValues((v) => ({
                ...v,
                frequency: e.target.value,
              }))
            }
          />
          <input
            value={editValues.dayOfMonth ?? ""}
            onChange={(e) =>
              setEditValues((v) => ({
                ...v,
                dayOfMonth: e.target.value,
              }))
            }
          />
          {(editValues.kind ?? "expense") === "expense" ? (
            <>
              <OptionPicker
                kind="expenseType"
                label="Expense Type"
                value={editValues.expenseType ?? ""}
                options={toOptionValues(userOptions?.expenseType)}
                placeholder="Type"
                onChange={(value) =>
                  setEditValues((v) => ({
                    ...v,
                    expenseType: value,
                  }))
                }
                onCreateOption={saveOption.bind(null, addUserOption)}
              />
              <OptionPicker
                kind="account"
                label="Expense Account"
                value={editValues.expenseAccount ?? ""}
                options={toOptionValues(userOptions?.account)}
                placeholder="Account"
                onChange={(value) =>
                  setEditValues((v) => ({
                    ...v,
                    expenseAccount: value,
                  }))
                }
                onCreateOption={saveOption.bind(null, addUserOption)}
              />
              <OptionPicker
                kind="category"
                label="Expense Category"
                value={editValues.expenseCategory ?? ""}
                options={toOptionValues(userOptions?.category)}
                placeholder="Category"
                onChange={(value) =>
                  setEditValues((v) => ({
                    ...v,
                    expenseCategory: value,
                  }))
                }
                onCreateOption={saveOption.bind(null, addUserOption)}
              />
              <input
                value={editValues.expensePaidTo ?? ""}
                onChange={(e) =>
                  setEditValues((v) => ({
                    ...v,
                    expensePaidTo: e.target.value,
                  }))
                }
                placeholder="Paid To"
              />
            </>
          ) : (
            <>
              <input
                value={editValues.incomingPaidBy ?? ""}
                onChange={(e) =>
                  setEditValues((v) => ({
                    ...v,
                    incomingPaidBy: e.target.value,
                  }))
                }
                placeholder="Paid By"
              />
              <OptionPicker
                kind="incomeType"
                label="Income Type"
                value={editValues.incomingType ?? ""}
                options={toOptionValues(userOptions?.incomeType)}
                placeholder="Income Type"
                onChange={(value) =>
                  setEditValues((v) => ({
                    ...v,
                    incomingType: value,
                  }))
                }
                onCreateOption={saveOption.bind(null, addUserOption)}
              />
              <OptionPicker
                kind="account"
                label="Incoming Account"
                value={editValues.incomingAccount ?? ""}
                options={toOptionValues(userOptions?.account)}
                placeholder="Account"
                onChange={(value) =>
                  setEditValues((v) => ({
                    ...v,
                    incomingAccount: value,
                  }))
                }
                onCreateOption={saveOption.bind(null, addUserOption)}
              />
            </>
          )}
          <input
            value={editValues.notes ?? ""}
            onChange={(e) =>
              setEditValues((v) => ({
                ...v,
                notes: e.target.value,
              }))
            }
          />
          <button
            type="button"
            className="save-plus-btn"
            aria-label="Save recurring changes"
            disabled={saving}
            onClick={onSave}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}