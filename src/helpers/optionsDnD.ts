import type { DragPayloadKind } from "../types/optionsDnD";

export function kindFromDraggingRowKey(
  draggingRowKey: string | null,
): DragPayloadKind | null {
  if (!draggingRowKey) return null;
  const [kind] = draggingRowKey.split(":");
  if (
    kind === "category" ||
    kind === "incomeType" ||
    kind === "subcategory" ||
    kind === "incomeSubtype"
  ) {
    return kind;
  }
  return null;
}