import { DisclosureSection, EntryModal, FormField, ModalActions, ModalSection } from "./EntryModal";
import { ExpensePaybackLinkManager, IncomingPaybackLinkManager } from "./PaybackLinkManager";
import { getScopedOptionValues, toOptionValues } from "../helpers/options";
import type { WorkspaceMutations } from "../types/workspaceActions";
import { EffectiveAmountControls } from "./EffectiveAmountControls";
import type { EditValues, UserOptions } from "../types/workspace";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { MonthYearMultiSelect } from "./MonthYearMultiSelect";
import type { Id } from "@pensive/convex-data-model";
import { parseMonthYears } from "../helpers/dates";
import { OptionPicker } from "./OptionPicker";
import { saveOption } from "../pages/actions";

type SharedProps = {
  editValues: EditValues;
  setEditValues: Dispatch<SetStateAction<EditValues>>;
  userOptions: UserOptions | undefined;
  addUserOption: WorkspaceMutations["addUserOption"];
  saving: boolean;
  fallbackDate: string;
  onClose: () => void;
  onSave: () => void;
  partnerEditor?: ReactNode;
};

export function ExpenseEditModal({
  expenseId,
  editValues,
  setEditValues,
  userOptions,
  addUserOption,
  saving,
  fallbackDate,
  onClose,
  onSave,
  partnerEditor,
}: SharedProps & {
  expenseId: Id<"expenses">;
}) {
  return (
    <EntryModal
      title="Edit expense"
      subtitle="Update the transaction and its allocation details."
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          primaryLabel={saving ? "Saving…" : "Save changes"}
          onPrimary={onSave}
          disabled={saving}
        />
      }
    >
      <ModalSection title="Details">
        <div className="modal-form-grid">
          <FormField label="Expense name" className="modal-field-wide">
            <input
              value={editValues.expense ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  expense: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Amount">
            <input
              inputMode="decimal"
              value={editValues.amount ?? ""}
              onChange={(event) =>
                setEditValues((values) => {
                  const amount = event.target.value;
                  return {
                    ...values,
                    amount,
                    effectiveAmount:
                      values.effectiveAmountMode === "manual"
                        ? values.effectiveAmount
                        : amount,
                  };
                })
              }
            />
          </FormField>
          <EffectiveAmountControls
            value={editValues.effectiveAmount ?? editValues.amount ?? ""}
            mode={
              editValues.effectiveAmountMode === "manual" ? "manual" : "auto"
            }
            onChange={(effectiveAmount) =>
              setEditValues((values) => ({ ...values, effectiveAmount }))
            }
            onModeChange={(effectiveAmountMode) =>
              setEditValues((values) => ({
                ...values,
                effectiveAmountMode,
                effectiveAmount:
                  effectiveAmountMode === "auto"
                    ? values.amount
                    : values.effectiveAmount,
              }))
            }
          />
          <FormField label="Date">
            <input
              type="date"
              value={editValues.date ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  date: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Paid to">
            <input
              value={editValues.paidTo ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  paidTo: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Account">
            <OptionPicker
              kind="account"
              label="Account"
              value={editValues.account ?? ""}
              options={toOptionValues(userOptions?.account)}
              placeholder="Choose account"
              onChange={(value) =>
                setEditValues((values) => ({ ...values, account: value }))
              }
              onCreateOption={saveOption.bind(null, addUserOption)}
            />
          </FormField>
          <FormField label="Category">
            <OptionPicker
              kind="category"
              label="Category"
              value={editValues.category ?? ""}
              options={toOptionValues(userOptions?.category)}
              placeholder="Choose category"
              onChange={(value) =>
                setEditValues((values) => {
                  const next: EditValues = { ...values, category: value };
                  const scoped = getScopedOptionValues(
                    userOptions,
                    "subcategory",
                    value,
                  );
                  if (
                    (next.subcategory ?? "") &&
                    !scoped.includes(next.subcategory ?? "")
                  )
                    next.subcategory = "";
                  return next;
                })
              }
              onCreateOption={saveOption.bind(null, addUserOption)}
            />
          </FormField>
          <FormField label="Subcategory" optional>
            <OptionPicker
              kind="subcategory"
              label="Subcategory"
              value={editValues.subcategory ?? ""}
              options={getScopedOptionValues(
                userOptions,
                "subcategory",
                editValues.category ?? "",
              )}
              placeholder="Choose subcategory"
              onChange={(value) =>
                setEditValues((values) => ({ ...values, subcategory: value }))
              }
              onCreateOption={saveOption.bind(null, addUserOption)}
              parentValue={editValues.category ?? ""}
            />
          </FormField>
        </div>
      </ModalSection>
      <MonthYearMultiSelect
        value={parseMonthYears(
          editValues.monthYears,
          editValues.date ?? fallbackDate,
        )}
        onChange={(value) =>
          setEditValues((values) => ({
            ...values,
            monthYears: JSON.stringify(value),
          }))
        }
        required
      />
      <ExpensePaybackLinkManager expenseId={expenseId} disabled={saving} />
      {partnerEditor}
      <DisclosureSection
        title="Notes & comments"
        summary={editValues.notes || editValues.comments ? "Added" : "Optional"}
      >
        <div className="modal-form-grid">
          <FormField label="Notes" optional>
            <textarea
              value={editValues.notes ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Comments" optional>
            <textarea
              value={editValues.comments ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  comments: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
      </DisclosureSection>
    </EntryModal>
  );
}

export function IncomingEditModal({
  incomingId,
  editValues,
  setEditValues,
  userOptions,
  addUserOption,
  saving,
  fallbackDate,
  onClose,
  onSave,
  partnerEditor,
}: SharedProps & {
  incomingId: Id<"incomings">;
}) {
  return (
    <EntryModal
      title="Edit incoming"
      subtitle="Update the money received and any reimbursement details."
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          primaryLabel={saving ? "Saving…" : "Save changes"}
          onPrimary={onSave}
          disabled={saving}
        />
      }
    >
      <ModalSection title="Details">
        <div className="modal-form-grid">
          <FormField label="Incoming name" className="modal-field-wide">
            <input
              value={editValues.incoming ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  incoming: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Amount">
            <input
              inputMode="decimal"
              value={editValues.amount ?? ""}
              onChange={(event) =>
                setEditValues((values) => {
                  const amount = event.target.value;
                  return {
                    ...values,
                    amount,
                    effectiveAmount:
                      values.effectiveAmountMode === "manual"
                        ? values.effectiveAmount
                        : amount,
                  };
                })
              }
            />
          </FormField>
          <EffectiveAmountControls
            value={editValues.effectiveAmount ?? editValues.amount ?? ""}
            mode={
              editValues.effectiveAmountMode === "manual" ? "manual" : "auto"
            }
            onChange={(effectiveAmount) =>
              setEditValues((values) => ({ ...values, effectiveAmount }))
            }
            onModeChange={(effectiveAmountMode) =>
              setEditValues((values) => ({
                ...values,
                effectiveAmountMode,
                effectiveAmount:
                  effectiveAmountMode === "auto"
                    ? values.amount
                    : values.effectiveAmount,
              }))
            }
          />
          <FormField label="Date">
            <input
              type="date"
              value={editValues.date ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  date: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Paid by">
            <input
              value={editValues.paidBy ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  paidBy: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Income type">
            <OptionPicker
              kind="incomeType"
              label="Income Type"
              value={editValues.incomeType ?? ""}
              options={toOptionValues(userOptions?.incomeType)}
              placeholder="Choose income type"
              onChange={(value) =>
                setEditValues((values) => {
                  const next: EditValues = { ...values, incomeType: value };
                  const scoped = getScopedOptionValues(
                    userOptions,
                    "incomeSubtype",
                    value,
                  );
                  if (
                    (next.incomeSubtype ?? "") &&
                    !scoped.includes(next.incomeSubtype ?? "")
                  )
                    next.incomeSubtype = "";
                  return next;
                })
              }
              onCreateOption={saveOption.bind(null, addUserOption)}
            />
          </FormField>
          <FormField label="Income subtype" optional>
            <OptionPicker
              kind="incomeSubtype"
              label="Income Subtype"
              value={editValues.incomeSubtype ?? ""}
              options={getScopedOptionValues(
                userOptions,
                "incomeSubtype",
                editValues.incomeType ?? "",
              )}
              placeholder="Choose income subtype"
              onChange={(value) =>
                setEditValues((values) => ({ ...values, incomeSubtype: value }))
              }
              onCreateOption={saveOption.bind(null, addUserOption)}
              parentValue={editValues.incomeType ?? ""}
            />
          </FormField>
          <FormField label="Account">
            <OptionPicker
              kind="account"
              label="Account"
              value={editValues.account ?? ""}
              options={toOptionValues(userOptions?.account)}
              placeholder="Choose account"
              onChange={(value) =>
                setEditValues((values) => ({ ...values, account: value }))
              }
              onCreateOption={saveOption.bind(null, addUserOption)}
            />
          </FormField>
        </div>
      </ModalSection>
      <MonthYearMultiSelect
        value={parseMonthYears(
          editValues.monthYears,
          editValues.date ?? fallbackDate,
        )}
        onChange={(value) =>
          setEditValues((values) => ({
            ...values,
            monthYears: JSON.stringify(value),
          }))
        }
        required
      />
      <IncomingPaybackLinkManager incomingId={incomingId} disabled={saving} />
      {partnerEditor}
      <DisclosureSection
        title="Notes & comments"
        summary={editValues.notes || editValues.comments ? "Added" : "Optional"}
      >
        <div className="modal-form-grid">
          <FormField label="Notes" optional>
            <textarea
              value={editValues.notes ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Comments" optional>
            <textarea
              value={editValues.comments ?? ""}
              onChange={(event) =>
                setEditValues((values) => ({
                  ...values,
                  comments: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
      </DisclosureSection>
    </EntryModal>
  );
}