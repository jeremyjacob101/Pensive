import { FormField } from "./EntryModal";

type EffectiveAmountMode = "auto" | "manual";

export function EffectiveAmountControls({ value, mode, onChange, onModeChange, inputName, modeName }: {
  value: string;
  mode: EffectiveAmountMode;
  onChange: (value: string) => void;
  onModeChange: (mode: EffectiveAmountMode) => void;
  inputName?: string;
  modeName?: string;
}) {
  return (
    <FormField label="Effective Amount">
      <div className="effective-amount-input">
        <input
          name={inputName}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onModeChange("manual");
          }}
          required
        />
        <button
          type="button"
          className={`effective-amount-auto${mode === "auto" ? " is-active" : ""}`}
          aria-pressed={mode === "auto"}
          title="Keep Effective Amount synced with Amount"
          onClick={() => onModeChange("auto")}
        >
          Auto
        </button>
      </div>
      {modeName ? <input type="hidden" name={modeName} value={mode} /> : null}
    </FormField>
  );
}