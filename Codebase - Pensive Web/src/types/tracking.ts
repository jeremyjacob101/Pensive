export type TrackingPickerKind = "expense" | "incoming";

export type TrackingOptionKind =
  | "category"
  | "subcategory"
  | "incomeType"
  | "incomeSubtype";

export type TrackingOptionRow = {
  id: string;
  kind: TrackingOptionKind;
  value: string;
  parentValue?: string;
  color: string;
  isTracking: boolean;
  indentationLevel: number;
};
