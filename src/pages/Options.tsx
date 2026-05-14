import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { optionKinds } from "../types/schema";
import type { CSSProperties } from "react";
import { saveOption } from "./actions";

export function Options() {
  const addUserOption = useMutation(api.userOptions.add);
  const updateUserOptionColor = useMutation(api.userOptions.updateColor);
  const setUserOptionDefault = useMutation(api.userOptions.setDefault);
  const removeUserOption = useMutation(api.userOptions.remove);
  const userOptions = useQuery(api.userOptions.list);

  return (
    <div className="options-page">
      {optionKinds.map(({ key, label }) => {
        const options = userOptions?.[key] ?? [];
        return (
          <section key={key} className="options-kind-card">
            <form
              className="options-add-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void saveOption(
                  addUserOption,
                  key,
                  String(form.get("value") ?? ""),
                );
                e.currentTarget.reset();
              }}
            >
              <label htmlFor={`add-option-${key}`}>{label}</label>
              <input
                id={`add-option-${key}`}
                name="value"
                placeholder={`Add ${label}`}
              />
              <button type="submit">Add</button>
            </form>

            <div className="options-row-list">
              {options.map((option) => (
                <div
                  key={`${key}-${option.value}`}
                  className="option-color-row"
                  style={
                    {
                      "--option-color": option.color || "#6B7280",
                    } as CSSProperties
                  }
                >
                  <div className="option-color-chip">
                    <input
                      aria-label={`Change color for ${option.value}`}
                      className="option-color-picker"
                      type="color"
                      value={option.color || "#6B7280"}
                      onChange={(e) =>
                        void updateUserOptionColor({
                          kind: key,
                          value: option.value,
                          color: e.target.value,
                        })
                      }
                    />
                  </div>
                  <span className="option-color-label">
                    <span className="option-color-name">{option.value}</span>
                    <span
                      className="option-color-underline"
                      aria-hidden="true"
                    />
                  </span>
                  <button
                    className={`option-star-btn${option.isDefault ? " is-default" : ""}`}
                    type="button"
                    aria-label={`${option.isDefault ? "Unset" : "Set"} default for ${option.value}`}
                    onClick={() =>
                      void setUserOptionDefault({
                        kind: key,
                        value: option.value,
                        isDefault: !option.isDefault,
                      })
                    }
                  >
                    ★
                  </button>
                  <button
                    className="option-remove-btn"
                    type="button"
                    onClick={() =>
                      void removeUserOption({ kind: key, value: option.value })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              {options.length === 0 ? (
                <div className="option-empty-hint">No options yet.</div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}