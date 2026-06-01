import { MonthYearMultiSelect } from "./MonthYearMultiSelect";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { PIE_CHART_PINNED_KEY } from "../keys/pieChart";
import type { UserOptions } from "../types/workspace";
import { CategoryPieChart } from "./CategoryPieChart";
import { useEffect, useMemo, useState } from "react";
import { getOptionColor } from "../helpers/options";
import type { PieRow } from "../types/pieChart";
import { Pin } from "lucide-react";

export function RangePieChartPanel({ rows, userOptions, mode, startDate, endDate, targetMonths, kind, onRangeChange, onMonthsChange, onReset }: {
  rows: PieRow[];
  userOptions: UserOptions | undefined;
  mode: "month" | "custom";
  startDate: string;
  endDate: string;
  targetMonths: string[];
  kind: "expense" | "incoming";
  onRangeChange: (start: string, end: string) => void;
  onMonthsChange: (months: string[]) => void;
  onReset: () => void;
}) {
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(
    mode === "custom",
  );
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showSubcategories, setShowSubcategories] = useState(false);
  const [storedPinned, setStoredPinned] = useLocalStorage(
    PIE_CHART_PINNED_KEY,
    "false",
  );
  const isPinned = storedPinned === "true";
  const editorMode =
    isCustomEditorOpen || mode === "custom" ? "custom" : "month";

  const categoryOptionKind = kind === "expense" ? "category" : "incomeType";
  const subcategoryOptionKind =
    kind === "expense" ? "subcategory" : "incomeSubtype";

  const pieData = useMemo(() => {
    const targetSet = mode === "month" ? new Set(targetMonths) : null;
    const map = new Map<string, number>();
    for (const row of rows) {
      const contribution =
        mode === "month"
          ? (() => {
              if (targetMonths.length === 0) return null;
              const matchingMonths = row.monthYears.filter((m) =>
                targetSet?.has(m));
              if (matchingMonths.length === 0) return null;
              const monthCount = Math.max(1, row.monthYears.length);
              const perMonthContribution = row.effectiveAmount / monthCount;
              return perMonthContribution * matchingMonths.length;
            })()
          : row.effectiveAmount;
      if (contribution === null) continue;
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
    mode,
    targetMonths,
    showSubcategories,
    userOptions,
    categoryOptionKind,
    subcategoryOptionKind,
  ]);

  const handleApply = () => {
    if (customStart && customEnd) {
      setIsCustomEditorOpen(true);
      onRangeChange(customStart, customEnd);
    }
  };

  const handleReset = () => {
    setIsCustomEditorOpen(false);
    setCustomStart("");
    setCustomEnd("");
    setShowSubcategories(false);
    onReset();
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const panel = document.querySelector(".month-indicator-area");
    if (!panel) return;
    panel.classList.toggle("month-indicator-area-pinned", isPinned);
    panel.classList.toggle("month-indicator-area-unpinned", !isPinned);

    return () => {
      panel.classList.remove("month-indicator-area-pinned");
      panel.classList.remove("month-indicator-area-unpinned");
    };
  }, [isPinned]);

  return (
    <div className="pie-chart-panel">
      <div className="pie-chart-panel-modes">
        <button
          type="button"
          className={`pie-mode-btn${editorMode === "month" ? " active" : ""}`}
          onClick={handleReset}
        >
          Months
        </button>
        <button
          type="button"
          className={`pie-mode-btn${editorMode === "custom" ? " active" : ""}`}
          onClick={() => {
            setIsCustomEditorOpen(true);
            setCustomStart(startDate);
            setCustomEnd(endDate);
          }}
        >
          Custom
        </button>
      </div>

      {editorMode === "month" && (
        <MonthYearMultiSelect
          label="Applied Months"
          value={targetMonths}
          onChange={onMonthsChange}
          required
        />
      )}

      {editorMode === "custom" && (
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

      <div className="pie-panel-toggle-row">
        <label className="pie-subcategory-toggle">
          <input
            type="checkbox"
            checked={showSubcategories}
            onChange={(e) => setShowSubcategories(e.target.checked)}
          />
          Show subcategories
        </label>

        <button
          type="button"
          className={`pie-pin-btn${isPinned ? " active" : ""}`}
          onClick={() => setStoredPinned(isPinned ? "false" : "true")}
          aria-pressed={isPinned}
          aria-label={isPinned ? "Unpin pie chart" : "Pin pie chart"}
          title={isPinned ? "Unpin pie chart" : "Pin pie chart"}
        >
          <Pin size={14} strokeWidth={2} />
        </button>
      </div>

      <CategoryPieChart data={pieData} />
    </div>
  );
}