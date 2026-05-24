import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { MonthNavigatorProps } from "../types/monthScope";
import { formatMonthYearLabel } from "../helpers/dates";

export function MonthNavigator({
  activeMonth,
  mode,
  customRangeLabel,
  canGoPrevious,
  canGoNext,
  canJumpToOldest,
  canJumpToNewest,
  onPrevious,
  onNext,
  onJumpToOldest,
  onJumpToNewest,
}: MonthNavigatorProps) {
  const displayLabel =
    mode === "custom"
      ? customRangeLabel
      : activeMonth
        ? formatMonthYearLabel(`${activeMonth}-01`)
        : "";

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