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
