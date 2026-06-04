export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export interface PieRow {
  monthYears: string[];
  effectiveAmount: number;
  category: string;
  subcategory?: string;
}
