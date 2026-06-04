import { formatMonthValue, getMonthsBetween, normalizeMonthYears, shiftMonth } from "../helpers/dates";
import { useCallback, useEffect, useMemo, useRef } from "react";

export function MonthYearMultiSelect({ value, onChange, label = "Months", required = false }: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  required?: boolean;
}) {
  const normalized = useMemo(() => normalizeMonthYears(value), [value]);
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const range = useMemo(() => {
    if (normalized.length > 0) {
      return { start: normalized[0], end: normalized[normalized.length - 1] };
    }
    return { start: currentMonth, end: currentMonth };
  }, [normalized, currentMonth]);

  const selectedSet = useMemo(() => new Set(normalized), [normalized]);

  const trackRef = useRef<HTMLDivElement>(null);

  const activeDrag = useRef<{
    type: "start" | "end";
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, type: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      activeDrag.current = {
        type,
        startX: e.clientX,
        origStart: range.start,
        origEnd: range.end,
      };
    },
    [range.start, range.end],
  );

  useEffect(() => {
    const monthWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--month-width",
      ),
      10,
    );

    const onPointerMove = (e: PointerEvent) => {
      const drag = activeDrag.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const delta = Math.round(dx / monthWidth);

      if (drag.type === "start") {
        let ns = shiftMonth(drag.origStart, delta);
        if (ns > drag.origEnd) ns = drag.origEnd;
        const all = getMonthsBetween(ns, drag.origEnd);
        onChange(all);
      } else {
        let ne = shiftMonth(drag.origEnd, delta);
        if (ne < drag.origStart) ne = drag.origStart;
        const all = getMonthsBetween(drag.origStart, ne);
        onChange(all);
      }
    };

    const onPointerUp = () => {
      activeDrag.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onChange]);

  const clickArrow = useCallback(
    (type: "start" | "end", dir: -1 | 1) => {
      if (type === "start") {
        const ns = shiftMonth(range.start, dir);
        if (ns > range.end) return;
        const all = getMonthsBetween(ns, range.end);
        onChange(all);
      } else {
        const ne = shiftMonth(range.end, dir);
        if (ne < range.start) return;
        const all = getMonthsBetween(range.start, ne);
        onChange(all);
      }
    },
    [onChange, range.start, range.end],
  );

  const toggleMonth = useCallback(
    (month: string) => {
      if (selectedSet.has(month)) {
        if (normalized.length <= 1) return;
        onChange(normalized.filter((m) => m !== month));
      } else {
        onChange(normalizeMonthYears([...normalized, month]));
      }
    },
    [normalized, selectedSet, onChange],
  );

  const timelineMonths = useMemo(() => {
    const edgeBufferMonths = 24;
    const startSeed = range.start < currentMonth ? range.start : currentMonth;
    const endSeed = range.end > currentMonth ? range.end : currentMonth;
    const start = shiftMonth(startSeed, -edgeBufferMonths);
    const end = shiftMonth(endSeed, edgeBufferMonths);
    return getMonthsBetween(start, end);
  }, [currentMonth, range.end, range.start]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const centerNode = track.querySelector<HTMLElement>(
        `[data-month="${currentMonth}"]`,
      );
      if (!centerNode) return;
      const trackRect = track.getBoundingClientRect();
      const nodeRect = centerNode.getBoundingClientRect();
      const target =
        track.scrollLeft +
        (nodeRect.left - trackRect.left) -
        trackRect.width / 2 +
        nodeRect.width / 2;
      track.scrollLeft = target;
    });
  }, [currentMonth]);

  return (
    <div className="month-multi-select">
      <label>{label}</label>
      <div className="month-range-slider" ref={trackRef}>
        <div className="month-range-track">
          {timelineMonths.map((month) => {
            const isSelected = selectedSet.has(month);
            const isInRange = month >= range.start && month <= range.end;
            const isStartEdge = month === range.start;
            const isEndEdge = month === range.end;
            const prevMonth = shiftMonth(month, -1);
            const showYear = month.slice(0, 4) !== prevMonth.slice(0, 4);

            return (
              <div key={month} className="month-tick-wrapper">
                {showYear && (
                  <div className="month-tick-year">{month.slice(0, 4)}</div>
                )}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {isStartEdge && (
                    <button
                      type="button"
                      className="month-range-handle month-range-handle-left"
                      onPointerDown={(e) => onPointerDown(e, "start")}
                      onClick={(e) => {
                        e.stopPropagation();
                        clickArrow("start", -1);
                      }}
                    >
                      ◀
                    </button>
                  )}
                  <button
                    type="button"
                    className={`month-tick${isSelected ? " month-tick-selected" : ""}${isInRange && !isSelected ? " month-tick-in-range" : ""}${!isInRange ? " month-tick-outside" : ""}`}
                    onClick={() => isInRange && toggleMonth(month)}
                    data-month={month}
                  >
                    {formatMonthValue(month)}
                  </button>
                  {isEndEdge && (
                    <button
                      type="button"
                      className="month-range-handle month-range-handle-right"
                      onPointerDown={(e) => onPointerDown(e, "end")}
                      onClick={(e) => {
                        e.stopPropagation();
                        clickArrow("end", 1);
                      }}
                    >
                      ▶
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="month-range-summary">
        {normalized.length === 1 ? (
          <span>{formatMonthValue(normalized[0])}</span>
        ) : (
          <span>{normalized.length} months selected</span>
        )}
      </div>
      {required && normalized.length === 0 ? (
        <div className="month-multi-select-error">
          Select at least one month.
        </div>
      ) : null}
    </div>
  );
}