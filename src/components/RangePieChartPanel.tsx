import { getMonthStartEnd, getMonthsInRange } from "../helpers/dates";
import type { RangePieChartPanelProps } from "../types/pieChart";
import { getOptionColor } from "../helpers/options";
import { CategoryPieChart } from "./CategoryPieChart";
import { useMemo, useState } from "react";

export function RangePieChartPanel({
  rows,
  userOptions,
  activeDate,
  kind,
  onRangeChange,
  onReset,
}: RangePieChartPanelProps) {
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showSubcategories, setShowSubcategories] = useState(false);

  const { start: monthStart, end: monthEnd } = useMemo(
    () => getMonthStartEnd(activeDate),
    [activeDate],
  );

  const effectiveStart = mode === "month" ? monthStart : customStart;
  const effectiveEnd = mode === "month" ? monthEnd : customEnd;

  const categoryOptionKind = kind === "expense" ? "category" : "incomeType";
  const subcategoryOptionKind =
    kind === "expense" ? "subcategory" : "incomeSubtype";

  const targetMonths = useMemo(
    () => getMonthsInRange(effectiveStart, effectiveEnd),
    [effectiveStart, effectiveEnd],
  );

  const pieData = useMemo(() => {
    if (targetMonths.length === 0) return [];
    const targetSet = new Set(targetMonths);
    const map = new Map<string, number>();
    for (const row of rows) {
      const matchingMonths = row.monthYears.filter((m) => targetSet.has(m));
      if (matchingMonths.length === 0) continue;
      const contribution = row.effectiveAmount * matchingMonths.length;
      const key =
        showSubcategories && row.subcategory ? row.subcategory : row.category;
      map.set(key, (map.get(key) ?? 0) + contribution);
    }
    const result: { label: string; value: number; color: string }[] = [];
    for (const [label, value] of map.entries()) {
      if (value === 0) continue;
      const color =
        showSubcategories && rows.find((r) => r.subcategory === label)
          ? getOptionColor(userOptions, subcategoryOptionKind, label)
          : getOptionColor(userOptions, categoryOptionKind, label);
      result.push({ label, value, color });
    }
    result.sort((a, b) => b.value - a.value);
    return result;
  }, [
    rows,
    targetMonths,
    showSubcategories,
    userOptions,
    categoryOptionKind,
    subcategoryOptionKind,
  ]);

  const handleApply = () => {
    if (customStart && customEnd) {
      onRangeChange(customStart, customEnd);
    }
  };

  const handleReset = () => {
    setMode("month");
    setCustomStart("");
    setCustomEnd("");
    setShowSubcategories(false);
    onReset();
  };

  return (
    <div className="pie-chart-panel">
      <div className="pie-chart-panel-modes">
        <button
          type="button"
          className={`pie-mode-btn${mode === "month" ? " active" : ""}`}
          onClick={() => {
            setMode("month");
            onReset();
          }}
        >
          This Month
        </button>
        <button
          type="button"
          className={`pie-mode-btn${mode === "custom" ? " active" : ""}`}
          onClick={() => setMode("custom")}
        >
          Custom Range
        </button>
      </div>

      {mode === "custom" && (
        <div className="pie-chart-panel-dates">
          <label className="pie-date-field">
            From
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label className="pie-date-field">
            To
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
          <div className="pie-date-actions">
            <button
              type="button"
              className="pie-apply-btn"
              onClick={handleApply}
              disabled={!customStart || !customEnd}
            >
              Apply
            </button>
            <button
              type="button"
              className="pie-reset-btn"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <label className="pie-subcategory-toggle">
        <input
          type="checkbox"
          checked={showSubcategories}
          onChange={(e) => setShowSubcategories(e.target.checked)}
        />
        Show subcategories
      </label>

      <CategoryPieChart data={pieData} />
    </div>
  );
}