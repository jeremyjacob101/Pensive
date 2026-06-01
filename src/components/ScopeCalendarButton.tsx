import { formatMonthYearShortLabel, getMonthsBetween, getTodayIsoDate } from "../helpers/dates";
import { fallbackCurrentMonth, validMonth } from "../helpers/monthScope";
import { useMemo, useState } from "react";

export function ScopeCalendarButton({ mode, targetMonths, startDate, endDate, monthBounds, onApplyMonths, onApplyCustom }: {
  mode: "month" | "custom";
  targetMonths: string[];
  startDate: string;
  endDate: string;
  monthBounds?: { oldestMonth: string | null; newestMonth: string | null };
  onApplyMonths: (months: string[]) => void;
  onApplyCustom: (startDate: string, endDate: string) => void;
}) {
  const [draftMode, setDraftMode] = useState<"month" | "custom">(mode);
  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate);

  const monthOptions = useMemo(() => {
    const todayMonth = fallbackCurrentMonth() || getTodayIsoDate().slice(0, 7);
    const oldest = validMonth(monthBounds?.oldestMonth)
      ? monthBounds.oldestMonth
      : todayMonth;
    const newest = validMonth(monthBounds?.newestMonth)
      ? monthBounds.newestMonth
      : todayMonth;
    const start = oldest <= newest ? oldest : newest;
    const finish = oldest <= newest ? newest : oldest;
    return getMonthsBetween(start, finish).reverse();
  }, [monthBounds]);

  const sortedSelectedMonths = useMemo(
    () => [...targetMonths].sort((a, b) => a.localeCompare(b)),
    [targetMonths],
  );
  const [draftStartMonth, setDraftStartMonth] = useState(
    sortedSelectedMonths[0] ?? monthOptions[monthOptions.length - 1] ?? "",
  );
  const [draftEndMonth, setDraftEndMonth] = useState(
    sortedSelectedMonths[sortedSelectedMonths.length - 1] ??
      monthOptions[0] ??
      "",
  );

  const canApplyMonths =
    !!draftStartMonth && !!draftEndMonth && draftStartMonth <= draftEndMonth;
  const canApplyCustom =
    !!draftStartDate && !!draftEndDate && draftStartDate <= draftEndDate;

  return (
    <div className="scope-simple-wrap">
      <div className="scope-calendar-mode-row">
        <button
          type="button"
          className={`scope-calendar-mode-btn${draftMode === "month" ? " active" : ""}`}
          onClick={() => setDraftMode("month")}
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
              onClick={() =>
                canApplyMonths
                  ? onApplyMonths(
                      getMonthsBetween(draftStartMonth, draftEndMonth),
                    )
                  : undefined
              }
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
              onClick={() =>
                canApplyCustom
                  ? onApplyCustom(draftStartDate, draftEndDate)
                  : undefined
              }
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}