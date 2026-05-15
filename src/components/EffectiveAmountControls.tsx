import type { Dispatch, SetStateAction } from "react";
import type { EditValues } from "../types/workspace";

export function EffectiveAmountControls({ editValues, setEditValues }: {
  editValues: EditValues;
  setEditValues: Dispatch<SetStateAction<EditValues>>;
}) {
  const mode = editValues.effectiveAmountMode === "manual" ? "manual" : "auto";

  return (
    <div className="effective-amount-editor">
      <label>
        <span>Effective Amount</span>
        <input
          value={editValues.effectiveAmount ?? ""}
          disabled={mode === "auto"}
          onChange={(event) =>
            setEditValues((values) => ({
              ...values,
              effectiveAmount: event.target.value,
            }))
          }
        />
      </label>
      <label className="effective-amount-toggle">
        <input
          type="checkbox"
          checked={mode === "manual"}
          onChange={(event) =>
            setEditValues((values) => ({
              ...values,
              effectiveAmountMode: event.target.checked ? "manual" : "auto",
            }))
          }
        />
        <span>{mode === "manual" ? "Manual" : "Auto"}</span>
      </label>
    </div>
  );
}