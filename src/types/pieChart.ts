import type { UserOptions } from "./workspace";

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export interface CategoryPieChartProps {
  data: PieSlice[];
  width?: number;
  height?: number;
}

export interface PieRow {
  monthYears: string[];
  effectiveAmount: number;
  category: string;
  subcategory?: string;
}

export interface RangePieChartPanelProps {
  rows: PieRow[];
  userOptions: UserOptions | undefined;
  activeDate: string;
  kind: "expense" | "incoming";
  onRangeChange: (start: string, end: string) => void;
  onReset: () => void;
}