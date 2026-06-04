export type DragPayloadKind =
  | "category"
  | "incomeType"
  | "subcategory"
  | "incomeSubtype";

export type DragPayload = {
  kind: DragPayloadKind;
  value: string;
  parentValue?: string;
};
