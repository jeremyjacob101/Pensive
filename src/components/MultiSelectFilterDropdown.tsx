import { useEffect, useMemo, useRef, useState } from "react";

export function MultiSelectFilterDropdown({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = selected.length === options.length;

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
          {selected.length}/{options.length}
        </span>
      </button>
      {open ? (
        <div className="filter-dropdown-menu">
          <div className="filter-dropdown-actions">
            <button
              type="button"
              className="filter-select-all-btn"
              onClick={() => onChange(options)}
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
            {options.map((option) => {
              const isChecked = selectedSet.has(option);
              return (
                <label key={option} className="filter-dropdown-option">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        onChange(selected.filter((value) => value !== option));
                      } else {
                        onChange([...selected, option]);
                      }
                    }}
                  />
                  <span>{option}</span>
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
