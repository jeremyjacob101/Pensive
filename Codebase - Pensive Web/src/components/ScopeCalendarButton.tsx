import { formatMonthYearShortLabel, getMonthsBetween, getTodayIsoDate } from "../helpers/dates";
import { fallbackCurrentMonth, validMonth } from "../helpers/monthScope";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";

export function ScopeCalendarButton({ mode, targetMonths, startDate, endDate, monthBounds, onApplyMonths, onApplyCustom }: {
  mode: "month" | "custom";
  targetMonths: string[];
  startDate: string;
  endDate: string;
  monthBounds?: { oldestMonth: string | null; newestMonth: string | null };
  onApplyMonths: (months: string[]) => void;
  onApplyCustom: (startDate: string, endDate: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<"month" | "custom">(mode);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate);
  const currentMonth = fallbackCurrentMonth() || getTodayIsoDate().slice(0, 7);

  const monthOptions = useMemo(() => {
    const oldest = validMonth(monthBounds?.oldestMonth)
      ? monthBounds.oldestMonth
      : currentMonth;
    const newestFromData = validMonth(monthBounds?.newestMonth)
      ? monthBounds.newestMonth
      : currentMonth;
    const newest =
      newestFromData > currentMonth ? newestFromData : currentMonth;
    const start = oldest <= newest ? oldest : newest;
    const finish = oldest <= newest ? newest : oldest;
    return getMonthsBetween(start, finish).reverse();
  }, [currentMonth, monthBounds]);

  const sortedSelectedMonths = useMemo(
    () => [...targetMonths].sort((a, b) => a.localeCompare(b)),
    [targetMonths],
  );
  const [draftStartMonth, setDraftStartMonth] = useState(currentMonth);
  const [draftEndMonth, setDraftEndMonth] = useState(
    sortedSelectedMonths[sortedSelectedMonths.length - 1] ?? currentMonth,
  );

  const canApplyMonths =
    !!draftStartMonth && !!draftEndMonth && draftStartMonth <= draftEndMonth;
  const canApplyCustom =
    !!draftStartDate && !!draftEndDate && draftStartDate <= draftEndDate;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="scope-picker-anchor" ref={wrapperRef}>
      <button
        type="button"
        className="scope-picker-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Scope selector"
      >
        <CalendarRange size={14} strokeWidth={2} />
      </button>
      <div className={`scope-simple-wrap${isOpen ? " is-open" : ""}`}>
        <div className="scope-calendar-mode-row">
          <button
            type="button"
            className={`scope-calendar-mode-btn${draftMode === "month" ? " active" : ""}`}
            onClick={() => {
              setDraftMode("month");
              setDraftStartMonth(currentMonth);
              setDraftEndMonth((previous) =>
                previous < currentMonth ? currentMonth : previous);
            }}
          >
            Months
          </button>
          <button
            type="button"
            className={`scope-calendar-mode-btn${draftMode === "custom" ? " active" : ""}`}
            onClick={() => {
              setDraftMode("custom");
              setDraftStartDate(startDate);
              setDraftEndDate(endDate);
            }}
          >
            Custom
          </button>
        </div>

        {draftMode === "month" ? (
          <div className="scope-calendar-panel">
            <label>
              Start Month
              <select
                value={draftStartMonth}
                onChange={(event) => setDraftStartMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={`start-${month}`} value={month}>
                    {formatMonthYearShortLabel(`${month}-01`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              End Month
              <select
                value={draftEndMonth}
                onChange={(event) => setDraftEndMonth(event.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={`end-${month}`} value={month}>
                    {formatMonthYearShortLabel(`${month}-01`)}
                  </option>
                ))}
              </select>
            </label>
            <div className="scope-calendar-actions">
              <button
                type="button"
                className="scope-calendar-apply"
                disabled={!canApplyMonths}
                onClick={() => {
                  if (!canApplyMonths) return;
                  onApplyMonths(
                    getMonthsBetween(draftStartMonth, draftEndMonth),
                  );
                  setIsOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div className="scope-calendar-panel">
            <label>
              Start Date
              <input
                type="date"
                value={draftStartDate}
                onChange={(event) => setDraftStartDate(event.target.value)}
              />
            </label>
            <label>
              End Date
              <input
                type="date"
                value={draftEndDate}
                onChange={(event) => setDraftEndDate(event.target.value)}
              />
            </label>
            <div className="scope-calendar-actions">
              <button
                type="button"
                className="scope-calendar-apply"
                disabled={!canApplyCustom}
                onClick={() => {
                  if (!canApplyCustom) return;
                  onApplyCustom(draftStartDate, draftEndDate);
                  setIsOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}