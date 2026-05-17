import { handleDeleteIncoming, handleStartEditIncoming, handleUpdateIncoming } from "./actions";
import { formatRangeLabel, formatShortDisplayDate, parseMonthYears } from "../helpers/dates";
import { getOptionColor, getScopedOptionValues, toOptionValues } from "../helpers/options";
import { EffectiveAmountControls } from "../components/EffectiveAmountControls";
import { IncomingPaybackLinkManager } from "../components/PaybackLinkManager";
import { useScrollMonthIndicator } from "../hooks/useScrollMonthIndicator";
import { MonthYearMultiSelect } from "../components/MonthYearMultiSelect";
import { formatMoney, getEffectiveAmount } from "../helpers/formatters";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { RangePieChartPanel } from "../components/RangePieChartPanel";
import { EditableRowActions } from "../components/EditableRowActions";
import type { Id } from "../../convex/_generated/dataModel";
import { useAutoLoadMore } from "../hooks/useAutoLoadMore";
import { OptionPicker } from "../components/OptionPicker";
import type { EditValues } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import { useMemo, useRef, useState } from "react";
import { parseSubId } from "../helpers/subId";
import { CreditCard } from "lucide-react";
import { saveOption } from "./actions";

export function Incomings() {
  const [editingIncomingId, setEditingIncomingId] = useState<string | null>(
    null,
  );
  const [expandedIncomingId, setExpandedIncomingId] = useState<string | null>(
    null,
  );
  const [partnerPickAnchorId, setPartnerPickAnchorId] =
    useState<Id<"incomings"> | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({});
  const [saving, setSaving] = useState(false);
  const [pieRangeStart, setPieRangeStart] = useState("");
  const [pieRangeEnd, setPieRangeEnd] = useState("");
  const [isPieDefaultMonth, setIsPieDefaultMonth] = useState(true);

  const updateIncoming = useMutation(api.incomings.update);
  const deleteIncoming = useMutation(api.incomings.remove);
  const addPartnerIncoming = useMutation(api.incomings.addPartnerIncoming);
  const unlinkIncomingFromPartners = useMutation(
    api.incomings.unlinkIncomingFromPartners,
  );
  const addUserOption = useMutation(api.userOptions.add);
  const userOptions = useQuery(api.userOptions.list);

  const {
    results: incomings,
    status: incomingsStatus,
    loadMore: loadMoreIncomings,
  } = usePaginatedQuery(api.incomings.list, {}, { initialNumItems: 50 });
  useAutoLoadMore(incomingsStatus, () => loadMoreIncomings(50));

  const displayItems = useMemo(() => {
    const groupedMap = new Map<
      string,
      {
        id: string;
        baseIncomingId: string;
        latestDate: string;
        latestCreation: number;
        totalAmount: number;
        totalEffectiveAmount: number;
        rows: typeof incomings;
      }
    >();

    const soloRows: typeof incomings = [];
    for (const row of incomings) {
      const baseId = (row.baseIncomingId ?? "").trim();
      if (!baseId) {
        soloRows.push(row);
        continue;
      }

      const existing = groupedMap.get(baseId);
      if (!existing) {
        groupedMap.set(baseId, {
          id: `group:${baseId}`,
          baseIncomingId: baseId,
          latestDate: row.date,
          latestCreation: row._creationTime,
          totalAmount: row.amount,
          totalEffectiveAmount: getEffectiveAmount(row),
          rows: [row],
        });
        continue;
      }

      existing.rows.push(row);
      existing.totalAmount += row.amount;
      existing.totalEffectiveAmount += getEffectiveAmount(row);
      if (
        row.date > existing.latestDate ||
        (row.date === existing.latestDate &&
          row._creationTime > existing.latestCreation)
      ) {
        existing.latestDate = row.date;
        existing.latestCreation = row._creationTime;
      }
    }

    const groupedItems = [...groupedMap.values()].map((group) => ({
      kind: "group" as const,
      id: group.id,
      date: group.latestDate,
      creation: group.latestCreation,
      group: {
        ...group,
        rows: [...group.rows].sort((a, b) => {
          const subDiff =
            parseSubId(a.subIncomingId) - parseSubId(b.subIncomingId);
          if (subDiff !== 0) return subDiff;
          return a._creationTime - b._creationTime;
        }),
      },
    }));

    const soloItems = soloRows.map((row) => ({
      kind: "solo" as const,
      id: `solo:${row._id}`,
      date: row.date,
      creation: row._creationTime,
      row,
    }));

    return [...groupedItems, ...soloItems].sort((a, b) => {
      if (a.date === b.date) {
        return b.creation - a.creation;
      }
      return b.date.localeCompare(a.date);
    });
  }, [incomings]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const { activeDate } = useScrollMonthIndicator(
    listRef,
    displayItems[0]?.date ?? "",
  );
  const rangeLabelText = formatRangeLabel(
    pieRangeStart || activeDate,
    pieRangeEnd || activeDate,
    isPieDefaultMonth,
  );
  const rangeLabelKey = `${rangeLabelText}-${isPieDefaultMonth}`;

  const handlePickPartner = async (partnerId: Id<"incomings">) => {
    if (!partnerPickAnchorId || partnerPickAnchorId === partnerId) return;
    setSaving(true);
    try {
      await addPartnerIncoming({
        anchorIncomingId: partnerPickAnchorId,
        partnerIncomingId: partnerId,
      });
      setPartnerPickAnchorId(null);
    } finally {
      setSaving(false);
    }
  };

  const renderPartnerEditor = (row: (typeof incomings)[number]) => {
    const baseId = (row.baseIncomingId ?? "").trim();
    const partnerRows = baseId
      ? incomings.filter(
          (incoming) =>
            incoming.baseIncomingId === baseId && incoming._id !== row._id,
        )
      : [];

    return (
      <div className="partner-editor">
        <div className="partner-editor-header">Partner Incomings</div>
        {partnerRows.length === 0 ? (
          <div className="partner-editor-empty">No partner incomings yet.</div>
        ) : (
          <div className="partner-editor-list">
            {partnerRows.map((partner) => (
              <div key={partner._id} className="partner-editor-row">
                <span>
                  {partner.incoming} · ₪{partner.amount.toLocaleString("en-US")}
                </span>
                <button
                  type="button"
                  className="icon-action-btn danger"
                  disabled={saving}
                  onClick={() =>
                    void unlinkIncomingFromPartners({ incomingId: partner._id })
                  }
                >
                  Unpartner
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="partner-editor-actions">
          <button
            type="button"
            className="split-entry-launcher"
            disabled={saving}
            onClick={() => {
              setEditingIncomingId(null);
              setPartnerPickAnchorId(row._id);
            }}
          >
            Add Partner
          </button>
          {baseId ? (
            <button
              type="button"
              className="icon-action-btn danger"
              disabled={saving}
              onClick={() =>
                void unlinkIncomingFromPartners({ incomingId: row._id })
              }
            >
              Unlink This Incoming
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      {displayItems.length === 0 ? (
        <p>No incomings yet.</p>
      ) : (
        <div className="entries-with-month">
          <aside className="month-indicator-area">
            <div className="month-indicator" aria-hidden="true">
              <span key={rangeLabelKey} className="month-indicator-value">
                <span className="month-indicator-range">{rangeLabelText}</span>
              </span>
            </div>
            <RangePieChartPanel
              rows={incomings.map((i) => ({
                monthYears: i.monthYears ?? [],
                effectiveAmount: getEffectiveAmount(i),
                category: i.incomeType,
                subcategory: i.incomeSubtype,
              }))}
              userOptions={userOptions}
              activeDate={activeDate}
              kind="incoming"
              onRangeChange={(start, end) => {
                setPieRangeStart(start);
                setPieRangeEnd(end);
                setIsPieDefaultMonth(false);
              }}
              onReset={() => {
                setPieRangeStart("");
                setPieRangeEnd("");
                setIsPieDefaultMonth(true);
              }}
            />
          </aside>
          <div ref={listRef} className="entry-card-list">
            <div className="expense-link-toolbar">
              {partnerPickAnchorId ? (
                <>
                  <div className="partner-pick-banner">
                    Pick an incoming row to add as partner
                  </div>
                  <button
                    type="button"
                    className="split-entry-launcher"
                    disabled={saving}
                    onClick={() => setPartnerPickAnchorId(null)}
                  >
                    Cancel Pick
                  </button>
                </>
              ) : null}
            </div>

            {displayItems.map((item) => {
              if (item.kind === "group") {
                const group = item.group;
                const firstRow = group.rows[0];
                const groupTitle = firstRow?.incoming || "Shared Incoming";
                const accountColor = getOptionColor(
                  userOptions,
                  "account",
                  firstRow.account,
                );
                const typeColor = getOptionColor(
                  userOptions,
                  "incomeType",
                  firstRow.incomeType,
                );
                const incomeSubtypeColor = firstRow.incomeSubtype
                  ? getOptionColor(
                      userOptions,
                      "incomeSubtype",
                      firstRow.incomeSubtype,
                    )
                  : null;
                const dotColor = incomeSubtypeColor ?? typeColor;
                const amountTooltip = group.rows
                  .map(
                    (row) =>
                      `${row.incoming}: ${formatMoney(row.amount)} raw / ${formatMoney(getEffectiveAmount(row))} effective`,
                  )
                  .join("\n");

                return (
                  <div
                    key={item.id}
                    data-row-date={item.date}
                    className="entry-card grouped-expense-card"
                  >
                    <div className="entry-card-main grouped-expense-main">
                      <div className="entry-card-primary">
                        <div
                          className="entry-card-amount"
                          title={amountTooltip}
                        >
                          <span
                            className="entry-card-account-icon-wrap"
                            data-tooltip={firstRow.account}
                          >
                            <CreditCard
                              className="entry-card-account-icon"
                              style={{ color: accountColor }}
                              aria-hidden="true"
                            />
                          </span>
                          <span>{formatMoney(group.totalEffectiveAmount)}</span>
                        </div>
                        <span
                          className="entry-card-primary-divider"
                          style={{ backgroundColor: typeColor, opacity: 0.8 }}
                          data-tooltip={firstRow.incomeType}
                          aria-hidden="true"
                        />
                        <div className="entry-card-title-wrap">
                          <span className="entry-card-title">{groupTitle}</span>
                          <span
                            className="entry-card-color-dot"
                            style={{ backgroundColor: dotColor }}
                            data-tooltip={
                              firstRow.incomeSubtype
                                ? `${firstRow.incomeType} / ${firstRow.incomeSubtype}`
                                : firstRow.incomeType
                            }
                          />
                        </div>
                      </div>

                      <div className="entry-card-date">
                        {formatShortDisplayDate(group.latestDate)}
                      </div>
                    </div>

                    <div className="entry-card-details grouped-expense-details">
                      {group.rows.map((row, index) => {
                        const isEditing = editingIncomingId === row._id;
                        const incomeTypeColor = getOptionColor(
                          userOptions,
                          "incomeType",
                          row.incomeType,
                        );
                        const incomeSubtypeColor = row.incomeSubtype
                          ? getOptionColor(
                              userOptions,
                              "incomeSubtype",
                              row.incomeSubtype,
                            )
                          : null;
                        const dotColor = incomeSubtypeColor ?? incomeTypeColor;

                        return (
                          <div
                            key={row._id}
                            className={`grouped-expense-row${index > 0 ? " has-divider" : ""}${partnerPickAnchorId ? " partner-pick-target" : ""}`}
                            onClick={() =>
                              partnerPickAnchorId
                                ? void handlePickPartner(row._id)
                                : undefined
                            }
                          >
                            <div className="grouped-expense-row-main">
                              <div className="grouped-expense-row-title-wrap">
                                <span className="grouped-expense-row-title">
                                  {row.incoming}
                                </span>
                                <span
                                  className="entry-card-color-dot"
                                  style={{ backgroundColor: dotColor }}
                                />
                              </div>
                              <div className="grouped-expense-row-meta">
                                {row.incomeType}
                                {row.incomeSubtype
                                  ? ` / ${row.incomeSubtype}`
                                  : ""}{" "}
                                · {row.paidBy} · {row.account}
                              </div>
                            </div>

                            <div className="grouped-expense-row-amount-date">
                              <span className="grouped-expense-row-amount">
                                {formatMoney(row.amount)}
                              </span>
                              <span className="grouped-expense-row-effective">
                                {formatMoney(getEffectiveAmount(row))} effective
                              </span>
                              <span className="grouped-expense-row-date">
                                {formatShortDisplayDate(row.date)}
                              </span>
                            </div>

                            <div className="entry-row-controls grouped-expense-row-controls">
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
                                  handleDeleteIncoming(
                                    row,
                                    deleteIncoming,
                                    setSaving,
                                  )
                                }
                              />
                            </div>

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
                                      options={toOptionValues(
                                        userOptions?.incomeType,
                                      )}
                                      placeholder="Income Type"
                                      onChange={(value) =>
                                        setEditValues((v) => {
                                          const next: EditValues = {
                                            ...v,
                                            incomeType: value,
                                          };
                                          const scoped = getScopedOptionValues(
                                            userOptions,
                                            "incomeSubtype",
                                            value,
                                          );
                                          if (
                                            (next.incomeSubtype ?? "") &&
                                            !scoped.includes(
                                              next.incomeSubtype ?? "",
                                            )
                                          ) {
                                            next.incomeSubtype = "";
                                          }
                                          return next;
                                        })
                                      }
                                      onCreateOption={saveOption.bind(
                                        null,
                                        addUserOption,
                                      )}
                                    />
                                    <OptionPicker
                                      kind="incomeSubtype"
                                      label="Income Subtype"
                                      value={editValues.incomeSubtype ?? ""}
                                      options={getScopedOptionValues(
                                        userOptions,
                                        "incomeSubtype",
                                        editValues.incomeType ?? "",
                                      )}
                                      placeholder="Income Subtype"
                                      onChange={(value) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          incomeSubtype: value,
                                        }))
                                      }
                                      onCreateOption={saveOption.bind(
                                        null,
                                        addUserOption,
                                      )}
                                      parentValue={editValues.incomeType ?? ""}
                                    />
                                    <OptionPicker
                                      kind="account"
                                      label="Account"
                                      value={editValues.account ?? ""}
                                      options={toOptionValues(
                                        userOptions?.account,
                                      )}
                                      placeholder="Account"
                                      onChange={(value) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          account: value,
                                        }))
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
                                    <EffectiveAmountControls
                                      editValues={editValues}
                                      setEditValues={setEditValues}
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
                                    <MonthYearMultiSelect
                                      value={parseMonthYears(
                                        editValues.monthYears,
                                        editValues.date ?? row.date,
                                      )}
                                      onChange={(value) =>
                                        setEditValues((v) => ({
                                          ...v,
                                          monthYears: JSON.stringify(value),
                                        }))
                                      }
                                      required
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
                                    {renderPartnerEditor(row)}
                                    <IncomingPaybackLinkManager
                                      incomingId={row._id}
                                      disabled={saving}
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
                );
              }

              const row = item.row;
              const isExpanded = expandedIncomingId === row._id;
              const isEditing = editingIncomingId === row._id;
              const incomeTypeColor = getOptionColor(
                userOptions,
                "incomeType",
                row.incomeType,
              );
              const incomeSubtypeColor = row.incomeSubtype
                ? getOptionColor(
                    userOptions,
                    "incomeSubtype",
                    row.incomeSubtype,
                  )
                : null;
              const dotColor = incomeSubtypeColor ?? incomeTypeColor;
              const accountColor = getOptionColor(
                userOptions,
                "account",
                row.account,
              );

              return (
                <div
                  key={item.id}
                  data-row-date={item.date}
                  className={`entry-card${isExpanded ? " is-expanded" : ""}${partnerPickAnchorId ? " partner-pick-target" : ""}`}
                  onClick={() =>
                    partnerPickAnchorId
                      ? void handlePickPartner(row._id)
                      : undefined
                  }
                >
                  <div className="entry-card-main">
                    <div className="entry-card-primary">
                      <div className="entry-card-amount">
                        <span
                          className="entry-card-account-icon-wrap"
                          data-tooltip={row.account}
                        >
                          <CreditCard
                            className="entry-card-account-icon"
                            style={{ color: accountColor }}
                            aria-hidden="true"
                          />
                        </span>
                        <span>{formatMoney(getEffectiveAmount(row))}</span>
                      </div>
                      <span
                        className="entry-card-primary-divider"
                        style={{
                          backgroundColor: incomeTypeColor,
                          opacity: 0.8,
                        }}
                        data-tooltip={row.incomeType}
                        aria-hidden="true"
                      />
                      <div className="entry-card-title-wrap">
                        <span className="entry-card-title">{row.incoming}</span>
                        <span
                          className="entry-card-color-dot"
                          style={{ backgroundColor: dotColor }}
                          data-tooltip={
                            row.incomeSubtype
                              ? `${row.incomeType} / ${row.incomeSubtype}`
                              : row.incomeType
                          }
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
                          <strong>Income Subtype:</strong>{" "}
                          {row.incomeSubtype || "-"}
                        </div>
                        <div>
                          <strong>Paid By:</strong> {row.paidBy}
                        </div>
                        <div>
                          <strong>Account:</strong> {row.account}
                        </div>
                        <div>
                          <strong>Months:</strong>{" "}
                          {(row.monthYears ?? [])
                            .map((month) => {
                              const parsed = new Date(`${month}-01T00:00:00`);
                              if (Number.isNaN(parsed.getTime())) return month;
                              return new Intl.DateTimeFormat("en-US", {
                                month: "long",
                                year: "numeric",
                              }).format(parsed);
                            })
                            .join(", ") || "-"}
                        </div>
                        <div>
                          <strong>Amount:</strong> {formatMoney(row.amount)}
                        </div>
                        <div>
                          <strong>Effective:</strong>{" "}
                          {formatMoney(getEffectiveAmount(row))}
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
                              setEditValues((v) => {
                                const next: EditValues = {
                                  ...v,
                                  incomeType: value,
                                };
                                const scoped = getScopedOptionValues(
                                  userOptions,
                                  "incomeSubtype",
                                  value,
                                );
                                if (
                                  (next.incomeSubtype ?? "") &&
                                  !scoped.includes(next.incomeSubtype ?? "")
                                ) {
                                  next.incomeSubtype = "";
                                }
                                return next;
                              })
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                          />
                          <OptionPicker
                            kind="incomeSubtype"
                            label="Income Subtype"
                            value={editValues.incomeSubtype ?? ""}
                            options={getScopedOptionValues(
                              userOptions,
                              "incomeSubtype",
                              editValues.incomeType ?? "",
                            )}
                            placeholder="Income Subtype"
                            onChange={(value) =>
                              setEditValues((v) => ({
                                ...v,
                                incomeSubtype: value,
                              }))
                            }
                            onCreateOption={saveOption.bind(
                              null,
                              addUserOption,
                            )}
                            parentValue={editValues.incomeType ?? ""}
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
                          <EffectiveAmountControls
                            editValues={editValues}
                            setEditValues={setEditValues}
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
                          <MonthYearMultiSelect
                            value={parseMonthYears(
                              editValues.monthYears,
                              editValues.date ?? row.date,
                            )}
                            onChange={(value) =>
                              setEditValues((v) => ({
                                ...v,
                                monthYears: JSON.stringify(value),
                              }))
                            }
                            required
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
                          {renderPartnerEditor(row)}
                          <IncomingPaybackLinkManager
                            incomingId={row._id}
                            disabled={saving}
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