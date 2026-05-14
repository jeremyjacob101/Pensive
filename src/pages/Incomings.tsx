import { handleDeleteIncoming, handleStartEditIncoming, handleUpdateIncoming } from "./actions";
import { formatMonthLabel, formatShortDisplayDate, formatYearLabel } from "../helpers/dates";
import { useScrollMonthIndicator } from "../hooks/useScrollMonthIndicator";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { EditableRowActions } from "../components/EditableRowActions";
import { getOptionColor, toOptionValues } from "../helpers/options";
import { useAutoLoadMore } from "../hooks/useAutoLoadMore";
import { OptionPicker } from "../components/OptionPicker";
import type { EditValues } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import { CreditCard } from "lucide-react";
import { useRef, useState } from "react";
import { saveOption } from "./actions";

export function Incomings() {
  const [editingIncomingId, setEditingIncomingId] = useState<string | null>(
    null,
  );
  const [expandedIncomingId, setExpandedIncomingId] = useState<string | null>(
    null,
  );
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);

  const updateIncoming = useMutation(api.incomings.update);
  const deleteIncoming = useMutation(api.incomings.remove);
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);

  const {
    results: incomings,
    status: incomingsStatus,
    loadMore: loadMoreIncomings,
  } = usePaginatedQuery(api.incomings.list, {}, { initialNumItems: 50 });
  useAutoLoadMore(incomingsStatus, () => loadMoreIncomings(50));
  const listRef = useRef<HTMLDivElement | null>(null);
  const { activeDate } = useScrollMonthIndicator(
    listRef,
    incomings[0]?.date ?? "",
  );
  const monthText = formatMonthLabel(activeDate);
  const yearText = formatYearLabel(activeDate);
  const labelKey = `${monthText}-${yearText}`;

  return (
    <>
      {incomings.length === 0 ? (
        <p>No incomings yet.</p>
      ) : (
        <div className="entries-with-month">
          <aside className="month-indicator" aria-hidden="true">
            <span key={labelKey} className="month-indicator-value">
              <span className="month-indicator-month">{monthText}</span>
              <span className="month-indicator-year">{yearText}</span>
            </span>
          </aside>
          <div ref={listRef} className="entry-card-list">
            {incomings.map((row) => {
              const isExpanded = expandedIncomingId === row._id;
              const isEditing = editingIncomingId === row._id;
              const incomeTypeColor = getOptionColor(
                userOptions,
                "incomeType",
                row.incomeType,
              );
              const accountColor = getOptionColor(
                userOptions,
                "account",
                row.account,
              );

              return (
                <div
                  key={row._id}
                  data-row-date={row.date}
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
                        <span>₪{row.amount}</span>
                      </div>
                      <span
                        className="entry-card-primary-divider"
                        aria-hidden="true"
                      />
                      <div className="entry-card-title-wrap">
                        <span className="entry-card-title">{row.incoming}</span>
                        <span
                          className="entry-card-color-dot"
                          style={{ backgroundColor: incomeTypeColor }}
                        />
                      </div>
                    </div>
                    <div className="entry-card-date">
                      {formatShortDisplayDate(row.date)}
                    </div>
                    <div className="entry-row-controls">
                      <EditableRowActions
                        isEditing={false}
                        saving={saving}
                        onSave={() => {}}
                        onCancel={() => {}}
                        onEdit={() =>
                          handleStartEditIncoming(
                            row,
                            setEditingIncomingId,
                            setEditValues,
                          )
                        }
                        onDelete={() =>
                          handleDeleteIncoming(row, deleteIncoming, setSaving)
                        }
                      />
                      <button
                        type="button"
                        className="icon-action-btn"
                        onClick={() =>
                          setExpandedIncomingId((prev) =>
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
                          <strong>Income Type:</strong> {row.incomeType}
                        </div>
                        <div>
                          <strong>Paid By:</strong> {row.paidBy}
                        </div>
                        <div>
                          <strong>Account:</strong> {row.account}
                        </div>
                        <div>
                          <strong>Month/Year:</strong> {row.monthYear}
                        </div>
                        <div>
                          <strong>Notes:</strong> {row.notes ?? "-"}
                        </div>
                        <div>
                          <strong>Comments:</strong> {row.comments ?? "-"}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isEditing ? (
                    <div
                      className="modal-overlay"
                      onClick={() => setEditingIncomingId(null)}
                    >
                      <div
                        className="modal-card"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="modal-header">
                          <h3>Edit Incoming</h3>
                          <button
                            type="button"
                            className="modal-close"
                            onClick={() => setEditingIncomingId(null)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="entry-form modal-form">
                          <input
                            value={editValues.incoming ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                incoming: e.target.value,
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
                            kind="incomeType"
                            label="Income Type"
                            value={editValues.incomeType ?? ""}
                            options={toOptionValues(userOptions?.incomeType)}
                            placeholder="Income Type"
                            onChange={(value) =>
                              setEditValues((v) => ({
                                ...v,
                                incomeType: value,
                              }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="account"
                            label="Account"
                            value={editValues.account ?? ""}
                            options={toOptionValues(userOptions?.account)}
                            placeholder="Account"
                            onChange={(value) =>
                              setEditValues((v) => ({ ...v, account: value }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <input
                            value={editValues.amount ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                amount: e.target.value,
                              }))
                            }
                          />
                          <input
                            type="date"
                            value={editValues.date ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                date: e.target.value,
                              }))
                            }
                          />
                          <input
                            value={editValues.monthYear ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                monthYear: e.target.value,
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
                          <input
                            value={editValues.comments ?? ""}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                comments: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="save-plus-btn"
                            aria-label="Save incoming changes"
                            disabled={saving}
                            onClick={() =>
                              handleUpdateIncoming(row, {
                                updateIncoming,
                                editValues,
                                setSaving,
                                setEditingIncomingId,
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
        </div>
      )}
    </>
  );
}