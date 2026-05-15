import type { OptionKind } from "../types/schema";

const CREATE_NEW_OPTION_VALUE = "__create_new_option__";

export function OptionPicker({ kind, label, name, value, options, placeholder, required = false, disabled = false, onChange, onCreateOption, parentValue }: {
  kind: OptionKind;
  label: string;
  name?: string;
  value: string;
  options: string[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onCreateOption: (
    kind: OptionKind,
    value: string,
    parentValue?: string,
  ) => Promise<void>;
  parentValue?: string;
}) {
  const hasCurrentValue = value !== "" && options.includes(value);

  const handleSelect = async (
    selectedValue: string,
    kind: OptionKind,
    currentValue: string,
  ) => {
    if (selectedValue !== CREATE_NEW_OPTION_VALUE) {
      onChange(selectedValue);
      return;
    }

    const created = window.prompt(`Create new ${label}`);
    const trimmed = (created ?? "").trim();
    if (!trimmed) {
      onChange(currentValue);
      return;
    }

    await onCreateOption(kind, trimmed, parentValue);
    onChange(trimmed);
  };

  return (
    <select
      name={name}
      value={value}
      required={required}
      disabled={disabled}
      onChange={(e) => {
        void handleSelect(e.target.value, kind, value);
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {!hasCurrentValue && value !== "" && (
        <option value={value}>{value}</option>
      )}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value="__divider__" disabled>
        ──────────
      </option>
      <option value={CREATE_NEW_OPTION_VALUE}>+ Create new option</option>
    </select>
  );
}