import { formatMonthValue, getMonthsBetween, normalizeMonthYears, shiftMonth, toggleMonthYearSelection } from "../helpers/dates";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function formatSelectionSpan(start: string, end: string) {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const startMonth = MONTH_NAMES[Number(start.slice(5, 7)) - 1];
  const endMonth = MONTH_NAMES[Number(end.slice(5, 7)) - 1];

  if (start === end) return formatMonthValue(start);
  if (startYear === endYear) return `${startMonth} – ${endMonth} ${endYear}`;
  return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
}

export function MonthYearMultiSelect({ value, onChange, label = "Applies to", required = false, defaultExpanded = false }: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  required?: boolean;
  defaultExpanded?: boolean;
}) {
  const normalized = useMemo(() => normalizeMonthYears(value), [value]);
  const selectedSet = useMemo(() => new Set(normalized), [normalized]);
  const [currentMonth] = useState(currentMonthValue);
  const [visibleYear, setVisibleYear] = useState(() =>
    Number(
      normalized[normalized.length - 1]?.slice(0, 4) ??
        currentMonth.slice(0, 4),
    ));
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const labelId = useId();
  const summaryId = useId();
  const helpId = useId();
  const errorId = useId();

  const visibleMonths = useMemo(
    () =>
      MONTH_NAMES.map((name, index) => ({
        name,
        value: `${visibleYear}-${String(index + 1).padStart(2, "0")}`,
      })),
    [visibleYear],
  );

  const rangeStart = normalized[0] ?? "";
  const rangeEnd = normalized[normalized.length - 1] ?? "";
  const spanLength =
    rangeStart && rangeEnd ? getMonthsBetween(rangeStart, rangeEnd).length : 0;
  const selectionSummary =
    normalized.length === 0
      ? "No months selected"
      : normalized.length === 1
        ? formatMonthValue(normalized[0])
        : `${formatSelectionSpan(rangeStart, rangeEnd)} · ${normalized.length}${normalized.length === spanLength ? "" : ` of ${spanLength}`} months`;

  const focusMonth = useCallback((month: string) => {
    setVisibleYear(Number(month.slice(0, 4)));
    requestAnimationFrame(() => buttonRefs.current.get(month)?.focus());
  }, []);

  const handleMonthKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, month: string) => {
      let target = "";
      if (event.key === "ArrowLeft") target = shiftMonth(month, -1);
      if (event.key === "ArrowRight") target = shiftMonth(month, 1);
      if (event.key === "ArrowUp") target = shiftMonth(month, -4);
      if (event.key === "ArrowDown") target = shiftMonth(month, 4);
      if (event.key === "PageUp") target = shiftMonth(month, -12);
      if (event.key === "PageDown") target = shiftMonth(month, 12);
      if (event.key === "Home") target = `${month.slice(0, 4)}-01`;
      if (event.key === "End") target = `${month.slice(0, 4)}-12`;
      if (!target) return;

      event.preventDefault();
      focusMonth(target);
    },
    [focusMonth],
  );

  const describedBy = [
    summaryId,
    helpId,
    required && normalized.length === 0 ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <details
      className="month-picker-disclosure"
      open={defaultExpanded || undefined}
    >
      <summary>
        <CalendarDays aria-hidden="true" />
        <span className="month-picker-disclosure-label">{label}</span>
        <span className="month-picker-disclosure-value">
          {selectionSummary}
        </span>
        <ChevronDown
          className="month-picker-disclosure-chevron"
          aria-hidden="true"
        />
      </summary>
      <fieldset className="month-multi-select" aria-describedby={describedBy}>
        <div className="month-picker-title-row">
          <legend id={labelId} className="month-picker-label">
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </legend>
          <button
            type="button"
            className="month-picker-clear"
            onClick={() => onChange([])}
            disabled={normalized.length === 0}
          >
            Clear
          </button>
        </div>

        <div className="month-picker-calendar">
          <div className="month-picker-year-row">
            <button
              type="button"
              className="month-picker-year-button"
              aria-label={`Show ${visibleYear - 1}`}
              onClick={() => setVisibleYear((year) => year - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="month-picker-year" aria-live="polite">
              {visibleYear}
            </div>
            <button
              type="button"
              className="month-picker-year-button"
              aria-label={`Show ${visibleYear + 1}`}
              onClick={() => setVisibleYear((year) => year + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <div
            className="month-picker-grid"
            role="grid"
            aria-labelledby={labelId}
          >
            {visibleMonths.map((month) => {
              const isSelected = selectedSet.has(month.value);
              const isGap =
                !isSelected &&
                !!rangeStart &&
                month.value > rangeStart &&
                month.value < rangeEnd;
              const isCurrent = month.value === currentMonth;
              const fullLabel = formatMonthValue(month.value);

              return (
                <button
                  key={month.value}
                  ref={(node) => {
                    if (node) buttonRefs.current.set(month.value, node);
                    else buttonRefs.current.delete(month.value);
                  }}
                  type="button"
                  role="gridcell"
                  className={`month-picker-month${isSelected ? " is-selected" : ""}${isGap ? " is-gap" : ""}${isCurrent ? " is-current" : ""}`}
                  aria-label={`${fullLabel}${isSelected ? ", selected; activate to exclude" : ", not selected; activate to include"}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    onChange(toggleMonthYearSelection(normalized, month.value))
                  }
                  onKeyDown={(event) => handleMonthKeyDown(event, month.value)}
                >
                  <span>{month.name}</span>
                  {isSelected ? (
                    <Check className="month-picker-check" aria-hidden="true" />
                  ) : null}
                  {isCurrent ? (
                    <span
                      className="month-picker-current-dot"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="month-picker-footer">
          <div
            id={summaryId}
            className="month-picker-summary"
            aria-live="polite"
          >
            {selectionSummary}
          </div>
          <div id={helpId} className="month-picker-help">
            Choose two endpoints to fill a range. Select any checked month to
            exclude it.
          </div>
        </div>

        {required ? (
          <input
            className="month-picker-required-input"
            value={normalized.length > 0 ? "selected" : ""}
            onChange={() => {}}
            onInvalid={(event) => {
              event.preventDefault();
              buttonRefs.current.get(`${visibleYear}-01`)?.focus();
            }}
            tabIndex={-1}
            aria-hidden="true"
            required
          />
        ) : null}
        {required && normalized.length === 0 ? (
          <div id={errorId} className="month-multi-select-error" role="alert">
            Select at least one month.
          </div>
        ) : null}
      </fieldset>
    </details>
  );
}