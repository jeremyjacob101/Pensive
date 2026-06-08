import { formatMonthShort, getMonthsBetween, MAX_BUFFER_MONTHS, monthInTrailingBuffer, parseBufferByRow, parseStartByRow, snapToNewestMonth, TRACKING_VISIBLE_SEGMENTS } from "../helpers/tracking";
import { TRACKING_BUFFER_BY_ROW_KEY, TRACKING_START_BY_ROW_KEY } from "../keys/tracking";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { UserOption } from "../types/workspace";
import { ListChecks } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@pensive/convex-api";
import { useMutation, useQuery } from "convex/react";

type TrackingPickerKind = "expense" | "incoming";
type TrackingOptionKind =
  | "category"
  | "subcategory"
  | "incomeType"
  | "incomeSubtype";
type TrackingOptionRow = {
  id: string;
  kind: TrackingOptionKind;
  value: string;
  parentValue?: string;
  color: string;
  isTracking: boolean;
  indentationLevel: number;
};

const trackingOptionKey = (
  kind: TrackingOptionKind,
  value: string,
  parentValue?: string,
) => `${kind}|${value}|${parentValue ?? ""}`;

export function Tracking() {
  const tracking = useQuery(api.tracking.list);
  const userOptions = useQuery(api.userOptions.list);
  const setUserOptionTracking = useMutation(api.userOptions.setTracking);
  const [pickerKind, setPickerKind] = useState<TrackingPickerKind | null>(null);
  const [draftTracking, setDraftTracking] = useState<Record<string, boolean>>(
    {},
  );
  const [originalTracking, setOriginalTracking] = useState<
    Record<string, boolean>
  >({});
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingPickerError, setTrackingPickerError] = useState<string | null>(
    null,
  );
  const [storedStartByRow, setStoredStartByRow] = useLocalStorage(
    TRACKING_START_BY_ROW_KEY,
    "{}",
  );
  const [storedBufferByRow, setStoredBufferByRow] = useLocalStorage(
    TRACKING_BUFFER_BY_ROW_KEY,
    "{}",
  );
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const startByRow = useMemo(
    () => parseStartByRow(storedStartByRow),
    [storedStartByRow],
  );
  const bufferByRow = useMemo(
    () => parseBufferByRow(storedBufferByRow),
    [storedBufferByRow],
  );

  const grouped = useMemo(() => {
    const rows = tracking?.rows ?? [];
    return {
      expense: rows.filter((row) => row.source === "expense"),
      incoming: rows.filter((row) => row.source === "incoming"),
    };
  }, [tracking?.rows]);

  const trackingOptionRows = useMemo(() => {
    const trackedKeys = new Set(
      (tracking?.rows ?? []).map((row) =>
        trackingOptionKey(
          row.kind as TrackingOptionKind,
          row.value,
          row.parentValue,
        )),
    );
    return {
      expense: buildTrackingOptionRows(
        userOptions?.category ?? [],
        "category",
        userOptions?.subcategory ?? [],
        "subcategory",
        trackedKeys,
      ),
      incoming: buildTrackingOptionRows(
        userOptions?.incomeType ?? [],
        "incomeType",
        userOptions?.incomeSubtype ?? [],
        "incomeSubtype",
        trackedKeys,
      ),
    };
  }, [tracking?.rows, userOptions]);

  const timelineByRow = useMemo(() => {
    if (!tracking) return {};

    const out: Record<
      string,
      { rangeMonths: string[]; startOptions: string[]; paidSet: Set<string> }
    > = {};

    for (const row of tracking.rows) {
      const paidMonths = [...(row.paidMonths ?? [])].sort((a, b) =>
        a.localeCompare(b));
      const paidSet = new Set(paidMonths);
      if (paidMonths.length === 0) {
        out[row.key] = { rangeMonths: [], startOptions: [], paidSet };
        continue;
      }

      const earliest = paidMonths[0];
      const latest = paidMonths[paidMonths.length - 1];
      const end =
        earliest > tracking.currentMonth ? latest : tracking.currentMonth;
      const startOptions = getMonthsBetween(earliest, end);
      const selectedStart = startByRow[row.key] ?? earliest;
      const effectiveStart = startOptions.includes(selectedStart)
        ? selectedStart
        : earliest;
      const rangeMonths = getMonthsBetween(effectiveStart, end);
      out[row.key] = { rangeMonths, startOptions, paidSet };
    }

    return out;
  }, [startByRow, tracking]);

  useEffect(() => {
    if (!tracking) return;
    setStoredStartByRow((currentRaw) => {
      const current = parseStartByRow(currentRaw);
      const next: Record<string, string> = {};
      let changed = false;
      const validKeys = new Set(tracking.rows.map((row) => row.key));

      for (const [key, value] of Object.entries(current)) {
        if (!validKeys.has(key)) {
          changed = true;
          continue;
        }
        next[key] = value;
      }

      for (const row of tracking.rows) {
        const paidMonths = [...(row.paidMonths ?? [])].sort((a, b) =>
          a.localeCompare(b));
        if (paidMonths.length === 0) continue;
        if (!next[row.key] || !/^\d{4}-\d{2}$/.test(next[row.key])) {
          next[row.key] = paidMonths[0];
          changed = true;
        }
      }
      return changed ? JSON.stringify(next) : currentRaw;
    });
  }, [setStoredStartByRow, tracking]);

  useEffect(() => {
    if (!tracking) return;
    setStoredBufferByRow((currentRaw) => {
      const current = parseBufferByRow(currentRaw);
      const next: Record<string, number> = {};
      let changed = false;
      const validKeys = new Set(tracking.rows.map((row) => row.key));

      for (const [key, value] of Object.entries(current)) {
        if (!validKeys.has(key)) {
          changed = true;
          continue;
        }
        next[key] = Math.max(0, Math.min(MAX_BUFFER_MONTHS, Math.trunc(value)));
      }

      for (const row of tracking.rows) {
        if (next[row.key] === undefined) {
          next[row.key] = 0;
          changed = true;
        }
      }

      return changed ? JSON.stringify(next) : currentRaw;
    });
  }, [setStoredBufferByRow, tracking]);

  useEffect(() => {
    if (!tracking) return;
    const frame = requestAnimationFrame(() => {
      for (const row of tracking.rows) {
        snapToNewestMonth(scrollRefs.current[row.key]);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [timelineByRow, tracking]);

  if (tracking === undefined) {
    return <p>Loading tracking...</p>;
  }

  const openTrackingPicker = (kind: TrackingPickerKind) => {
    const rows = trackingOptionRows[kind];
    const selection = Object.fromEntries(
      rows.map((row) => [row.id, row.isTracking]),
    );
    setPickerKind(kind);
    setOriginalTracking(selection);
    setDraftTracking(selection);
    setTrackingPickerError(null);
  };

  const closeTrackingPicker = () => {
    if (savingTracking) return;
    setPickerKind(null);
    setDraftTracking({});
    setOriginalTracking({});
    setTrackingPickerError(null);
  };

  const saveTrackingPicker = async () => {
    if (!pickerKind) return;
    setSavingTracking(true);
    setTrackingPickerError(null);
    const rowsByID = new Map(
      trackingOptionRows[pickerKind].map((row) => [row.id, row]),
    );
    const changes = Object.entries(draftTracking)
      .filter(([id, isTracking]) => originalTracking[id] !== isTracking)
      .map(([id, isTracking]) => ({ row: rowsByID.get(id), isTracking }))
      .filter(
        (change): change is { row: TrackingOptionRow; isTracking: boolean } =>
          Boolean(change.row),
      );

    try {
      for (const change of changes) {
        await setUserOptionTracking({
          kind: change.row.kind,
          value: change.row.value,
          parentValue: change.row.parentValue,
          isTracking: change.isTracking,
        });
      }
      closeTrackingPicker();
    } catch {
      setTrackingPickerError("Failed to update tracking.");
    } finally {
      setSavingTracking(false);
    }
  };

  return (
    <div className="tracking-page">
      <section className="tracking-section">
        <div className="tracking-section-header">
          <h3>Expenses</h3>
          <button
            type="button"
            className="archive-axis-plus notepad-top-plus tracking-section-add"
            aria-label="Manage expense tracking"
            onClick={() => openTrackingPicker("expense")}
          >
            +
          </button>
        </div>
        {grouped.expense.length === 0 ? (
          <p className="tracking-section-empty">No tracked expense rows.</p>
        ) : (
          grouped.expense.map((row) => (
            <article key={row.key} className="tracking-row-card">
              <div className="tracking-row-body">
                <div className="tracking-row-left">
                  <div className="tracking-row-head">
                    <div className="tracking-row-label">
                      <span
                        className="tracking-row-color"
                        style={{ backgroundColor: row.color }}
                      />
                      <span>{row.label}</span>
                    </div>
                    <label className="tracking-start-inline">
                      <span>Start</span>
                      <select
                        value={startByRow[row.key] ?? ""}
                        onChange={(event) =>
                          setStoredStartByRow((currentRaw) =>
                            JSON.stringify({
                              ...parseStartByRow(currentRaw),
                              [row.key]: event.target.value,
                            }))
                        }
                        disabled={
                          (timelineByRow[row.key]?.startOptions.length ?? 0) ===
                          0
                        }
                      >
                        {(timelineByRow[row.key]?.startOptions ?? []).map((
                          month,
                        ) => (
                          <option
                            key={`${row.key}:start:${month}`}
                            value={month}
                          >
                            {formatMonthShort(month)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {(timelineByRow[row.key]?.rangeMonths.length ?? 0) === 0 ? (
                  <div className="tracking-no-paid">No paid months yet.</div>
                ) : (
                  <div
                    className="tracking-months-scroll"
                    ref={(node) => {
                      scrollRefs.current[row.key] = node;
                      if (node) snapToNewestMonth(node);
                    }}
                  >
                    <div className="tracking-pipeline">
                      {(() => {
                        const rangeMonths =
                          timelineByRow[row.key]?.rangeMonths ?? [];
                        const leftEmptyCount = Math.max(
                          0,
                          TRACKING_VISIBLE_SEGMENTS - rangeMonths.length,
                        );
                        const visibleMonths = [
                          ...Array.from({ length: leftEmptyCount }, () => ""),
                          ...rangeMonths,
                        ];

                        return (
                          <>
                            <div className="tracking-pipeline-bar">
                              {visibleMonths.map((month, index) => {
                                if (!month) {
                                  return (
                                    <span
                                      key={`${row.key}:empty-segment:${index}`}
                                      className="tracking-pipeline-segment is-empty"
                                    />
                                  );
                                }
                                const isPaid =
                                  timelineByRow[row.key]?.paidSet.has(month) ??
                                  false;
                                const bufferMonths = bufferByRow[row.key] ?? 0;
                                const isBuffer =
                                  !isPaid &&
                                  monthInTrailingBuffer(
                                    month,
                                    tracking.currentMonth,
                                    bufferMonths,
                                  );
                                const isStart = index === leftEmptyCount;
                                return (
                                  <span
                                    key={`${row.key}:${month}:segment`}
                                    className={`tracking-pipeline-segment${
                                      isPaid
                                        ? " is-paid"
                                        : isBuffer
                                          ? " is-buffer"
                                          : " is-unpaid"
                                    }${isStart ? " is-start" : ""}`}
                                    title={`${row.label} · ${formatMonthShort(month)} · ${
                                      isPaid
                                        ? "paid"
                                        : isBuffer
                                          ? "buffer"
                                          : "unpaid"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                            <div className="tracking-pipeline-labels">
                              {visibleMonths.map((month, index) =>
                                month ? (
                                  <span
                                    key={`${row.key}:${month}:label`}
                                    className="tracking-pipeline-month-label"
                                  >
                                    {formatMonthShort(month)}
                                  </span>
                                ) : (
                                  <span
                                    key={`${row.key}:empty-label:${index}`}
                                    className="tracking-pipeline-month-label is-empty"
                                  />
                                ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <label className="tracking-buffer-inline">
                  <span>Buffer</span>
                  <select
                    value={String(bufferByRow[row.key] ?? 0)}
                    onChange={(event) =>
                      setStoredBufferByRow((currentRaw) =>
                        JSON.stringify({
                          ...parseBufferByRow(currentRaw),
                          [row.key]: Math.max(
                            0,
                            Math.min(
                              MAX_BUFFER_MONTHS,
                              Number.parseInt(event.target.value, 10) || 0,
                            ),
                          ),
                        }))
                    }
                  >
                    {Array.from({ length: MAX_BUFFER_MONTHS + 1 }, (
                      _,
                      count,
                    ) => (
                      <option key={`${row.key}:buffer:${count}`} value={count}>
                        {count}m
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="tracking-section">
        <div className="tracking-section-header">
          <h3>Incomings</h3>
          <button
            type="button"
            className="archive-axis-plus notepad-top-plus tracking-section-add"
            aria-label="Manage incoming tracking"
            onClick={() => openTrackingPicker("incoming")}
          >
            +
          </button>
        </div>
        {grouped.incoming.length === 0 ? (
          <p className="tracking-section-empty">No tracked incoming rows.</p>
        ) : (
          grouped.incoming.map((row) => (
            <article key={row.key} className="tracking-row-card">
              <div className="tracking-row-body">
                <div className="tracking-row-left">
                  <div className="tracking-row-head">
                    <div className="tracking-row-label">
                      <span
                        className="tracking-row-color"
                        style={{ backgroundColor: row.color }}
                      />
                      <span>{row.label}</span>
                    </div>
                    <label className="tracking-start-inline">
                      <span>Start</span>
                      <select
                        value={startByRow[row.key] ?? ""}
                        onChange={(event) =>
                          setStoredStartByRow((currentRaw) =>
                            JSON.stringify({
                              ...parseStartByRow(currentRaw),
                              [row.key]: event.target.value,
                            }))
                        }
                        disabled={
                          (timelineByRow[row.key]?.startOptions.length ?? 0) ===
                          0
                        }
                      >
                        {(timelineByRow[row.key]?.startOptions ?? []).map((
                          month,
                        ) => (
                          <option
                            key={`${row.key}:start:${month}`}
                            value={month}
                          >
                            {formatMonthShort(month)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {(timelineByRow[row.key]?.rangeMonths.length ?? 0) === 0 ? (
                  <div className="tracking-no-paid">No paid months yet.</div>
                ) : (
                  <div
                    className="tracking-months-scroll"
                    ref={(node) => {
                      scrollRefs.current[row.key] = node;
                      if (node) snapToNewestMonth(node);
                    }}
                  >
                    <div className="tracking-pipeline">
                      {(() => {
                        const rangeMonths =
                          timelineByRow[row.key]?.rangeMonths ?? [];
                        const leftEmptyCount = Math.max(
                          0,
                          TRACKING_VISIBLE_SEGMENTS - rangeMonths.length,
                        );
                        const visibleMonths = [
                          ...Array.from({ length: leftEmptyCount }, () => ""),
                          ...rangeMonths,
                        ];

                        return (
                          <>
                            <div className="tracking-pipeline-bar">
                              {visibleMonths.map((month, index) => {
                                if (!month) {
                                  return (
                                    <span
                                      key={`${row.key}:empty-segment:${index}`}
                                      className="tracking-pipeline-segment is-empty"
                                    />
                                  );
                                }
                                const isPaid =
                                  timelineByRow[row.key]?.paidSet.has(month) ??
                                  false;
                                const bufferMonths = bufferByRow[row.key] ?? 0;
                                const isBuffer =
                                  !isPaid &&
                                  monthInTrailingBuffer(
                                    month,
                                    tracking.currentMonth,
                                    bufferMonths,
                                  );
                                const isStart = index === leftEmptyCount;
                                return (
                                  <span
                                    key={`${row.key}:${month}:segment`}
                                    className={`tracking-pipeline-segment${
                                      isPaid
                                        ? " is-paid"
                                        : isBuffer
                                          ? " is-buffer"
                                          : " is-unpaid"
                                    }${isStart ? " is-start" : ""}`}
                                    title={`${row.label} · ${formatMonthShort(month)} · ${
                                      isPaid
                                        ? "paid"
                                        : isBuffer
                                          ? "buffer"
                                          : "unpaid"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                            <div className="tracking-pipeline-labels">
                              {visibleMonths.map((month, index) =>
                                month ? (
                                  <span
                                    key={`${row.key}:${month}:label`}
                                    className="tracking-pipeline-month-label"
                                  >
                                    {formatMonthShort(month)}
                                  </span>
                                ) : (
                                  <span
                                    key={`${row.key}:empty-label:${index}`}
                                    className="tracking-pipeline-month-label is-empty"
                                  />
                                ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
                <label className="tracking-buffer-inline">
                  <span>Buffer</span>
                  <select
                    value={String(bufferByRow[row.key] ?? 0)}
                    onChange={(event) =>
                      setStoredBufferByRow((currentRaw) =>
                        JSON.stringify({
                          ...parseBufferByRow(currentRaw),
                          [row.key]: Math.max(
                            0,
                            Math.min(
                              MAX_BUFFER_MONTHS,
                              Number.parseInt(event.target.value, 10) || 0,
                            ),
                          ),
                        }))
                    }
                  >
                    {Array.from({ length: MAX_BUFFER_MONTHS + 1 }, (
                      _,
                      count,
                    ) => (
                      <option key={`${row.key}:buffer:${count}`} value={count}>
                        {count}m
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          ))
        )}
      </section>
      {pickerKind ? (
        <div className="modal-overlay" onClick={closeTrackingPicker}>
          <div
            className="modal-card tracking-picker-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                {pickerKind === "expense"
                  ? "Expense Tracking"
                  : "Incoming Tracking"}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeTrackingPicker}
                disabled={savingTracking}
              >
                ✕
              </button>
            </div>
            <div className="tracking-picker-list">
              {trackingOptionRows[pickerKind].length === 0 ? (
                <p className="tracking-section-empty">
                  {pickerKind === "expense"
                    ? "No expense options yet."
                    : "No incoming options yet."}
                </p>
              ) : (
                trackingOptionRows[pickerKind].map((row) => (
                  <button
                    type="button"
                    key={row.id}
                    className="tracking-picker-row"
                    style={
                      {
                        "--option-color": row.color || "#6B7280",
                        "--tracking-picker-indent": `${row.indentationLevel * 22}px`,
                      } as CSSProperties
                    }
                    onClick={() =>
                      setDraftTracking((current) => ({
                        ...current,
                        [row.id]: !current[row.id],
                      }))
                    }
                  >
                    <span
                      className={`option-track-btn${
                        draftTracking[row.id] ? " is-active" : ""
                      }`}
                    >
                      <ListChecks size={14} strokeWidth={2.2} />
                    </span>
                    <span className="option-color-dot" />
                    <span className="tracking-picker-label">
                      <span>{row.value}</span>
                      {row.parentValue ? <small>{row.parentValue}</small> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
            {trackingPickerError ? (
              <p className="tracking-picker-error">{trackingPickerError}</p>
            ) : null}
            <div className="tracking-picker-actions">
              <button
                type="button"
                onClick={closeTrackingPicker}
                disabled={savingTracking}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-plus-btn"
                onClick={() => void saveTrackingPicker()}
                disabled={savingTracking}
              >
                {savingTracking ? "Saving..." : "+"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildTrackingOptionRows(
  parents: UserOption[],
  parentKind: Extract<TrackingOptionKind, "category" | "incomeType">,
  children: UserOption[],
  childKind: Extract<TrackingOptionKind, "subcategory" | "incomeSubtype">,
  trackedKeys: Set<string>,
): TrackingOptionRow[] {
  const childrenByParent = new Map<string, UserOption[]>();
  for (const child of children) {
    const parent = child.parentValue ?? "";
    childrenByParent.set(parent, [...(childrenByParent.get(parent) ?? []), child]);
  }

  const displayedChildren = new Set<string>();
  const rows: TrackingOptionRow[] = [];

  for (const parent of [...parents].sort(compareOptions)) {
    rows.push(toTrackingOptionRow(parent, parentKind, 0, trackedKeys));
    for (const child of [...(childrenByParent.get(parent.value) ?? [])].sort(
      compareOptions,
    )) {
      displayedChildren.add(`${child.value}|${child.parentValue ?? ""}`);
      rows.push(toTrackingOptionRow(child, childKind, 1, trackedKeys));
    }
  }

  const orphans = children
    .filter((child) => !displayedChildren.has(`${child.value}|${child.parentValue ?? ""}`))
    .sort(compareOptions);
  rows.push(
    ...orphans.map((child) =>
      toTrackingOptionRow(child, childKind, 0, trackedKeys),
    ),
  );

  return rows;
}

function toTrackingOptionRow(
  option: UserOption,
  kind: TrackingOptionKind,
  indentationLevel: number,
  trackedKeys: Set<string>,
): TrackingOptionRow {
  const id = trackingOptionKey(kind, option.value, option.parentValue);
  return {
    id,
    kind,
    value: option.value,
    parentValue: option.parentValue,
    color: option.color,
    indentationLevel,
    isTracking: Boolean(option.isTracking) || trackedKeys.has(id),
  };
}

function compareOptions(lhs: UserOption, rhs: UserOption) {
  const parentCompare = (lhs.parentValue ?? "").localeCompare(
    rhs.parentValue ?? "",
  );
  if (parentCompare !== 0) return parentCompare;
  return lhs.value.localeCompare(rhs.value);
}
