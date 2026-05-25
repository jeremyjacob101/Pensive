import { formatMonthShort, getMonthsBetween, MAX_BUFFER_MONTHS, monthInTrailingBuffer, parseBufferByRow, parseStartByRow, snapToNewestMonth, TRACKING_VISIBLE_SEGMENTS } from "../helpers/tracking";
import { TRACKING_BUFFER_BY_ROW_KEY, TRACKING_START_BY_ROW_KEY } from "../keys/tracking";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../../convex/_generated/api";
import { useQuery } from "convex/react";

export function Tracking() {
  const tracking = useQuery(api.tracking.list);
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

  if (tracking.rows.length === 0) {
    return (
      <div className="tracking-page">
        <div className="tracking-empty-card">
          No tracked categories yet. Mark category/subcategory or income
          type/subtype rows from Options.
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-page">
      <section className="tracking-section">
        <h3>Expenses</h3>
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
        <h3>Incomings</h3>
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
    </div>
  );
}