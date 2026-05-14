import { handleDeleteRecurring, handleStartEditRecurring, handleUpdateRecurring } from "./actions";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { EditableRowActions } from "../components/EditableRowActions";
import { getOptionColor, toOptionValues } from "../helpers/options";
import { useAutoLoadMore } from "../hooks/useAutoLoadMore";
import { OptionPicker } from "../components/OptionPicker";
import type { EditValues } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import { CreditCard } from "lucide-react";
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

  const updateRecurring = useMutation(api.recurrings.update);
  const deleteRecurring = useMutation(api.recurrings.remove);
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);

  const {
    results: recurrings,
    status: recurringsStatus,
    loadMore: loadMoreRecurrings,
  } = usePaginatedQuery(api.recurrings.list, {}, { initialNumItems: 50 });
  useAutoLoadMore(recurringsStatus, () => loadMoreRecurrings(50));

  return (
    <>
      {recurrings.length === 0 ? (
        <p>No recurrings yet.</p>
      ) : (
        <div className="entry-card-list">
          {recurrings.map((row) => {
            const isExpanded = expandedRecurringId === row._id;
            const isEditing = editingRecurringId === row._id;
            const categoryColor = getOptionColor(
              userOptions,
              "category",
              row.category,
            );
            const accountColor = getOptionColor(
              userOptions,
              "account",
              row.paidBy,
            );

            return (
              <div
                key={row._id}
                className={`entry-card${isExpanded ? " is-expanded" : ""}`}
              >
                <div className="entry-card-main">
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
                  <div className="entry-card-date">Day {row.dayOfMonth}</div>
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
                        handleDeleteRecurring(row, deleteRecurring, setSaving)
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
                        <strong>Status:</strong> {row.status}
                      </div>
                      <div>
                        <strong>Frequency:</strong> {row.frequency}
                      </div>
                      <div>
                        <strong>Paid By:</strong> {row.paidBy}
                      </div>
                      <div>
                        <strong>Category:</strong> {row.category}
                      </div>
                      <div>
                        <strong>Paid To:</strong> {row.paidTo}
                      </div>
                      <div>
                        <strong>Notes:</strong> {row.notes ?? "-"}
                      </div>
                    </div>
                  </div>
                ) : null}

                {isEditing ? (
                  <div
                    className="modal-overlay"
                    onClick={() => setEditingRecurringId(null)}
                  >
                    <div
                      className="modal-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="modal-header">
                        <h3>Edit Recurring</h3>
                        <button
                          type="button"
                          className="modal-close"
                          onClick={() => setEditingRecurringId(null)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="entry-form modal-form">
                        <input
                          value={editValues.status ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              status: e.target.value,
                            }))
                          }
                        />
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
                          value={editValues.type ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              type: e.target.value,
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
                        <input
                          value={editValues.paidBy ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              paidBy: e.target.value,
                            }))
                          }
                        />
                        <OptionPicker
                          kind="category"
                          label="Category"
                          value={editValues.category ?? ""}
                          options={toOptionValues(userOptions?.category)}
                          placeholder="Category"
                          onChange={(value) =>
                            setEditValues((v) => ({ ...v, category: value }))
                          }
                          onCreateOption={saveOption.bind(null, addUserOption)}
                        />
                        <input
                          value={editValues.paidTo ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              paidTo: e.target.value,
                            }))
                          }
                        />
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
                          onClick={() =>
                            handleUpdateRecurring(row, {
                              updateRecurring,
                              editValues,
                              setSaving,
                              setEditingRecurringId,
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}