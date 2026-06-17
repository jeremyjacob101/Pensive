import { useEffect, useMemo, useRef, useState } from "react";

export type MultiSelectFilterOption = {
  value: string;
  label?: string;
  color?: string;
};

export function MultiSelectFilterDropdown({ label, options, selected, onChange }: {
  label: string;
  options: Array<string | MultiSelectFilterOption>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const optionItems = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : { ...option, label: option.label ?? option.value }),
    [options],
  );
  const optionValues = useMemo(
    () => optionItems.map((option) => option.value),
    [optionItems],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = optionValues.every((option) => selectedSet.has(option));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = wrapRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="filter-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="filter-dropdown-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{label}</span>
        <span className="filter-dropdown-count">
          {optionValues.filter((option) => selectedSet.has(option)).length}/
          {optionValues.length}
        </span>
      </button>
      {open ? (
        <div className="filter-dropdown-menu">
          <div className="filter-dropdown-actions">
            <button
              type="button"
              className="filter-select-all-btn"
              onClick={() => onChange(optionValues)}
            >
              Select all
            </button>
            <button
              type="button"
              className="filter-select-all-btn"
              onClick={() => onChange([])}
            >
              Deselect all
            </button>
          </div>
          <div className="filter-dropdown-options">
            {optionItems.map((option) => {
              const isChecked = selectedSet.has(option.value);
              return (
                <label key={option.value} className="filter-dropdown-option">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        onChange(
                          selected.filter((value) => value !== option.value),
                        );
                      } else {
                        onChange([...selected, option.value]);
                      }
                    }}
                  />
                  {option.color ? (
                    <span
                      className="filter-dropdown-color-dot"
                      style={{ backgroundColor: option.color }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          {!allSelected ? (
            <div className="filter-dropdown-hint">Filtered</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}