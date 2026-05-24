import { kindFromDraggingRowKey } from "../helpers/optionsDnD";
import type { DragPayload } from "../types/optionsDnD";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { optionKinds } from "../types/schema";
import type { CSSProperties } from "react";
import { saveOption } from "./actions";
import { useState } from "react";

export function Options() {
  const addUserOption = useMutation(api.userOptions.add);
  const updateUserOptionColor = useMutation(api.userOptions.updateColor);
  const setUserOptionDefault = useMutation(api.userOptions.setDefault);
  const removeUserOption = useMutation(api.userOptions.remove);
  const moveToSubtype = useMutation(api.userOptions.moveToSubtype);
  const moveSubtype = useMutation(api.userOptions.moveSubtype);
  const renameUserOption = useMutation(api.userOptions.rename);
  const promoteSubtype = useMutation(api.userOptions.promoteSubtype);
  const userOptions = useQuery(api.userOptions.list);
  const [draggedOption, setDraggedOption] = useState<{
    kind: "category" | "incomeType" | "subcategory" | "incomeSubtype";
    value: string;
    parentValue?: string;
  } | null>(null);
  const [draggingRowKey, setDraggingRowKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<{
    kind:
      | "expenseType"
      | "account"
      | "category"
      | "subcategory"
      | "incomeType"
      | "incomeSubtype";
    value: string;
    parentValue?: string;
    color: string;
    nextValue: string;
    nextColor: string;
    label: string;
  } | null>(null);

  const resolveDragPayload = (event: { dataTransfer: DataTransfer | null }) => {
    if (draggedOption) return draggedOption;
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) {
      const fallbackKind = kindFromDraggingRowKey(draggingRowKey);
      if (!fallbackKind) return null;
      return { kind: fallbackKind, value: "" };
    }
    try {
      const parsed = JSON.parse(raw) as DragPayload;
      if (!parsed?.kind || !parsed?.value) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const confirmDelete = () =>
    window.confirm(
      "Are you sure you want to delete this item? This action cannot be undone.",
    );

  const removeOptionWithConfirm = (args: {
    kind:
      | "expenseType"
      | "account"
      | "category"
      | "subcategory"
      | "incomeType"
      | "incomeSubtype";
    value: string;
    parentValue?: string;
  }) => {
    if (!confirmDelete()) return;
    void removeUserOption(args);
  };

  return (
    <div className="options-page">
      {optionKinds
        .filter(({ key }) => key !== "subcategory" && key !== "incomeSubtype")
        .map(({ key, label }) => {
          const options = userOptions?.[key] ?? [];
          const childKind =
            key === "category"
              ? "subcategory"
              : key === "incomeType"
                ? "incomeSubtype"
                : null;
          const childOptions =
            childKind && userOptions?.[childKind] ? userOptions[childKind] : [];
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
                <div className="options-add-header">
                  <label htmlFor={`add-option-${key}`}>{label}</label>
                  {childKind ? (
                    <div
                      className={`option-promote-dropzone${
                        (key === "category" &&
                          draggingRowKey?.startsWith("subcategory:")) ||
                        (key === "incomeType" &&
                          draggingRowKey?.startsWith("incomeSubtype:"))
                          ? " is-visible"
                          : ""
                      }${
                        draggedOption &&
                        ((key === "category" &&
                          draggedOption.kind === "subcategory") ||
                          (key === "incomeType" &&
                            draggedOption.kind === "incomeSubtype"))
                          ? " is-drop-target"
                          : ""
                      }`}
                      onDragOver={(event) => {
                        const payload = resolveDragPayload(event);
                        const allowedKind =
                          key === "category" ? "subcategory" : "incomeSubtype";
                        const payloadKind =
                          payload?.kind ??
                          kindFromDraggingRowKey(draggingRowKey);
                        if (payloadKind !== allowedKind) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const payload = resolveDragPayload(event);
                        if (!payload) return;
                        const allowedKind =
                          key === "category" ? "subcategory" : "incomeSubtype";
                        if (payload.kind !== allowedKind) return;
                        if (!payload.parentValue) return;
                        void promoteSubtype({
                          kind: payload.kind,
                          value: payload.value,
                          parentValue: payload.parentValue,
                        });
                        setDraggedOption(null);
                      }}
                    >
                      Drop sub{key === "category" ? "category" : "type"} here to
                      separate
                    </div>
                  ) : null}
                </div>
                <input
                  id={`add-option-${key}`}
                  name="value"
                  placeholder={`Add ${label}`}
                />
                <button type="submit">Add</button>
              </form>

              <div className="options-row-list">
                {options.map((option) => {
                  const children = childKind
                    ? childOptions.filter(
                        (child) => (child.parentValue ?? "") === option.value,
                      )
                    : [];
                  return (
                    <div
                      key={`${key}-${option.value}`}
                      className={`option-parent-group${
                        dropTargetKey === `${key}:${option.value}`
                          ? " is-drop-target"
                          : ""
                      }`}
                      onDragOver={(event) => {
                        if (key !== "category" && key !== "incomeType") return;
                        const payload = resolveDragPayload(event);
                        const payloadKind =
                          payload?.kind ??
                          kindFromDraggingRowKey(draggingRowKey);
                        if (!payloadKind) return;
                        const targetSubtypeKind =
                          key === "category" ? "subcategory" : "incomeSubtype";
                        if (
                          payloadKind === key ||
                          payloadKind === targetSubtypeKind
                        ) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropTargetKey(`${key}:${option.value}`);
                        }
                      }}
                      onDrop={(event) => {
                        if (key !== "category" && key !== "incomeType") return;
                        event.preventDefault();
                        setDropTargetKey(null);
                        const dragged = resolveDragPayload(event);
                        setDraggedOption(null);
                        if (!dragged) return;
                        const targetSubtypeKind =
                          key === "category" ? "subcategory" : "incomeSubtype";

                        if (dragged.kind === key) {
                          if (dragged.value === option.value) return;
                          void moveToSubtype({
                            kind: key,
                            sourceValue: dragged.value,
                            targetValue: option.value,
                          });
                          return;
                        }

                        if (dragged.kind === targetSubtypeKind) {
                          if (!dragged.parentValue) return;
                          if (dragged.parentValue === option.value) return;
                          void moveSubtype({
                            kind: targetSubtypeKind,
                            value: dragged.value,
                            sourceParentValue: dragged.parentValue,
                            targetParentValue: option.value,
                          });
                        }
                      }}
                    >
                      <div
                        className={`option-color-row${childKind ? "" : " option-color-row-compact"}${
                          key === "category" || key === "incomeType"
                            ? " option-draggable"
                            : ""
                        }${draggingRowKey === `${key}:${option.value}` ? " is-dragging" : ""}`}
                        draggable={key === "category" || key === "incomeType"}
                        onDragOver={(event) => {
                          if (key !== "category" && key !== "incomeType")
                            return;
                          const payload = resolveDragPayload(event);
                          const payloadKind =
                            payload?.kind ??
                            kindFromDraggingRowKey(draggingRowKey);
                          if (!payloadKind) return;
                          const targetSubtypeKind =
                            key === "category"
                              ? "subcategory"
                              : "incomeSubtype";
                          if (
                            payloadKind === key ||
                            payloadKind === targetSubtypeKind
                          ) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDropTargetKey(`${key}:${option.value}`);
                          }
                        }}
                        onDragStart={(event) => {
                          if (key !== "category" && key !== "incomeType")
                            return;
                          setDraggedOption({
                            kind: key,
                            value: option.value,
                          });
                          setDraggingRowKey(`${key}:${option.value}`);
                          event.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({
                              kind: key,
                              value: option.value,
                            }),
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedOption(null);
                          setDropTargetKey(null);
                          setDraggingRowKey(null);
                        }}
                        style={
                          {
                            "--option-color": option.color || "#6B7280",
                          } as CSSProperties
                        }
                      >
                        <button
                          type="button"
                          draggable={false}
                          className={`option-color-chip option-color-chip-btn${option.isDefault ? " is-default" : ""}`}
                          aria-label={`Set default ${label} ${option.value}`}
                          onClick={() =>
                            void setUserOptionDefault({
                              kind: key,
                              value: option.value,
                              isDefault: !option.isDefault,
                            })
                          }
                        >
                          <span className="option-color-dot" />
                        </button>
                        <span className="option-color-label">
                          <span className="option-color-name">
                            {option.value}
                          </span>
                        </span>
                        {childKind ? (
                          <button
                            className="option-plus-btn"
                            type="button"
                            draggable={false}
                            onClick={() => {
                              const next = window
                                .prompt(
                                  `Add ${
                                    childKind === "subcategory"
                                      ? "subcategory"
                                      : "income subtype"
                                  } under ${option.value}`,
                                )
                                ?.trim();
                              if (!next) return;
                              void saveOption(
                                addUserOption,
                                childKind,
                                next,
                                option.value,
                              );
                            }}
                          >
                            +
                          </button>
                        ) : null}
                        <button
                          className="option-rename-btn"
                          type="button"
                          draggable={false}
                          onClick={() => {
                            setEditingOption({
                              kind: key,
                              value: option.value,
                              color: option.color || "#6B7280",
                              nextValue: option.value,
                              nextColor: option.color || "#6B7280",
                              label,
                            });
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className="option-remove-btn"
                          type="button"
                          draggable={false}
                          onClick={() =>
                            removeOptionWithConfirm({
                              kind: key,
                              value: option.value,
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                      {children.map((child) => (
                        <div
                          key={`${childKind}-${option.value}-${child.value}`}
                          draggable
                          onDragStart={(event) => {
                            setDraggedOption({
                              kind: childKind!,
                              value: child.value,
                              parentValue: option.value,
                            });
                            setDraggingRowKey(
                              `${childKind}:${option.value}:${child.value}`,
                            );
                            event.dataTransfer.setData(
                              "text/plain",
                              JSON.stringify({
                                kind: childKind,
                                value: child.value,
                                parentValue: option.value,
                              }),
                            );
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onMouseDown={() => {
                            setDraggingRowKey(
                              `${childKind}:${option.value}:${child.value}`,
                            );
                          }}
                          onDragEnd={() => {
                            setDraggedOption(null);
                            setDropTargetKey(null);
                            setDraggingRowKey(null);
                          }}
                          onDragStartCapture={() => {
                            setDraggingRowKey(
                              `${childKind}:${option.value}:${child.value}`,
                            );
                          }}
                          className={`option-color-row option-color-row-child option-color-row-compact option-draggable${
                            draggingRowKey ===
                            `${childKind}:${option.value}:${child.value}`
                              ? " is-dragging"
                              : ""
                          }`}
                          style={
                            {
                              "--option-color": child.color || "#6B7280",
                            } as CSSProperties
                          }
                        >
                          <button
                            type="button"
                            draggable={false}
                            className={`option-color-chip option-color-chip-btn${child.isDefault ? " is-default" : ""}`}
                            aria-label={`Set default ${childKind === "subcategory" ? "subcategory" : "income subtype"} ${child.value}`}
                            onClick={() =>
                              void setUserOptionDefault({
                                kind: childKind!,
                                value: child.value,
                                parentValue: option.value,
                                isDefault: !child.isDefault,
                              })
                            }
                          >
                            <span className="option-color-dot" />
                          </button>
                          <span className="option-color-label">
                            <span className="option-color-name">
                              {child.value}
                            </span>
                          </span>
                          <button
                            className="option-rename-btn"
                            type="button"
                            draggable={false}
                            onClick={() => {
                              setEditingOption({
                                kind: childKind!,
                                value: child.value,
                                parentValue: option.value,
                                color: child.color || "#6B7280",
                                nextValue: child.value,
                                nextColor: child.color || "#6B7280",
                                label:
                                  childKind === "subcategory"
                                    ? "Subcategory"
                                    : "Income Subtype",
                              });
                            }}
                          >
                            ✎
                          </button>
                          <button
                            className="option-remove-btn"
                            type="button"
                            draggable={false}
                            onClick={() =>
                              removeOptionWithConfirm({
                                kind: childKind!,
                                value: child.value,
                                parentValue: option.value,
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {options.length === 0 ? (
                  <div className="option-empty-hint">No options yet.</div>
                ) : null}
              </div>
            </section>
          );
        })}
      {editingOption ? (
        <div className="modal-overlay" onClick={() => setEditingOption(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit {editingOption.label}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditingOption(null)}
              >
                ✕
              </button>
            </div>
            <div className="entry-form modal-form">
              <input
                value={editingOption.nextValue}
                onChange={(e) =>
                  setEditingOption((current) =>
                    current
                      ? {
                          ...current,
                          nextValue: e.target.value,
                        }
                      : current)
                }
                placeholder="Name"
              />
              <label>
                Color
                <input
                  type="color"
                  value={editingOption.nextColor}
                  onChange={(e) =>
                    setEditingOption((current) =>
                      current
                        ? {
                            ...current,
                            nextColor: e.target.value,
                          }
                        : current)
                  }
                />
              </label>
              <button
                type="button"
                className="save-plus-btn"
                onClick={() => {
                  const nextName = editingOption.nextValue.trim();
                  const nextColor = editingOption.nextColor.trim();
                  if (!nextName || !nextColor) return;
                  const renamePromise =
                    nextName !== editingOption.value
                      ? renameUserOption({
                          kind: editingOption.kind,
                          value: editingOption.value,
                          parentValue: editingOption.parentValue,
                          nextValue: nextName,
                        })
                      : Promise.resolve();
                  void renamePromise
                    .then(() =>
                      updateUserOptionColor({
                        kind: editingOption.kind,
                        value: nextName,
                        parentValue: editingOption.parentValue,
                        color: nextColor,
                      }))
                    .then(() => setEditingOption(null));
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}