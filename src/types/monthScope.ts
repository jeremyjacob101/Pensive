export type MonthScopeMode = "month" | "custom";

export interface DateWindow {
  startDate: string;
  endDate: string;
}

export interface MonthBounds {
  newestMonth: string | null;
  oldestMonth: string | null;
}

export interface UseSingleMonthScopeInitialState {
  mode?: MonthScopeMode;
  activeMonth?: string | null;
  customRange?: DateWindow | null;
}

export interface MonthNavigatorProps {
  activeMonth: string | null;
  mode: "month" | "custom";
  customRangeLabel: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  canJumpToOldest: boolean;
  canJumpToNewest: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onJumpToOldest: () => void;
  onJumpToNewest: () => void;
}
