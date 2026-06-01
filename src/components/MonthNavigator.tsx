import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { formatMonthYearShortLabel } from "../helpers/dates";

export function MonthNavigator({ activeMonth, mode, customRangeLabel, targetMonths, canGoPrevious, canGoNext, canJumpToOldest, canJumpToNewest, onPrevious, onNext, onJumpToOldest, onJumpToNewest }: {
  activeMonth: string | null;
  mode: "month" | "custom";
  customRangeLabel: string;
  targetMonths?: string[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  canJumpToOldest: boolean;
  canJumpToNewest: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToOldest: () => void;
  onJumpToNewest: () => void;
}) {
  const monthRangeLabel = (() => {
    if (!targetMonths || targetMonths.length === 0) return "";
    if (targetMonths.length === 1) {
      return formatMonthYearShortLabel(`${targetMonths[0]}-01`);
    }
    const sorted = [...targetMonths].sort((a, b) => a.localeCompare(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstLabel = formatMonthYearShortLabel(`${first}-01`);
    const lastLabel = formatMonthYearShortLabel(`${last}-01`);
    return `${firstLabel} – ${lastLabel}`;
  })();

  const displayLabel =
    mode === "custom"
      ? customRangeLabel
      : monthRangeLabel ||
        (activeMonth ? formatMonthYearShortLabel(`${activeMonth}-01`) : "");

  return (
    <div className="month-navigator">
      <button
        type="button"
        className="month-nav-btn jump-btn"
        disabled={!canJumpToOldest}
        onClick={onJumpToOldest}
        title="Jump to oldest month"
        aria-label="Jump to oldest month"
      >
        <ChevronsLeft size={16} />
      </button>
      <button
        type="button"
        className="month-nav-btn prev-btn"
        disabled={!canGoPrevious}
        onClick={onPrevious}
        title="Previous month"
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="month-navigator-label">{displayLabel}</span>
      <button
        type="button"
        className="month-nav-btn next-btn"
        disabled={!canGoNext}
        onClick={onNext}
        title="Next month"
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
      <button
        type="button"
        className="month-nav-btn jump-btn"
        disabled={!canJumpToNewest}
        onClick={onJumpToNewest}
        title="Jump to newest month"
        aria-label="Jump to newest month"
      >
        <ChevronsRight size={16} />
      </button>
    </div>
  );
}