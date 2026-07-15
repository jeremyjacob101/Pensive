import { formatMoney, formatWarnings, getEffectiveAmount, toAmount } from "../helpers/formatters";
import { DisclosureSection, FormField } from "./EntryModal";
import type { PaybackDraft } from "../types/paybackDraft";
import { Link2, Pencil, Trash2, X } from "lucide-react";
import type { Id } from "@pensive/convex-data-model";
import { useMutation, useQuery } from "convex/react";
import { api } from "@pensive/convex-api";
import { useState } from "react";

function getCandidateName(candidate: { incoming?: string; expense?: string }) {
  return candidate.incoming ?? candidate.expense ?? "Untitled";
}

export function PaybackDraftEditor({ entryKind, value, onChange, disabled = false }: {
  entryKind: "expense" | "incoming";
  value: PaybackDraft;
  onChange: (value: PaybackDraft) => void;
  disabled?: boolean;
}) {
  const incomingCandidates = useQuery(
    api.paybackLinks.listIncomingCandidates,
    entryKind === "expense" ? {} : "skip",
  );
  const expenseCandidates = useQuery(
    api.paybackLinks.listExpenseCandidates,
    entryKind === "incoming" ? {} : "skip",
  );
  const candidates =
    entryKind === "expense" ? incomingCandidates : expenseCandidates;
  const targetLabel = entryKind === "expense" ? "incoming" : "expense";
  const selectedCandidate = candidates?.find(
    (candidate) => candidate._id === value.candidateId,
  );
  const summary = selectedCandidate
    ? `${getCandidateName(selectedCandidate)} · ${value.allocatedAmount ? formatMoney(toAmount(value.allocatedAmount)) : "set allocation"}`
    : `No payback linked`;

  return (
    <DisclosureSection
      title="Payback"
      summary={summary}
      className="payback-draft-disclosure"
    >
      <div className="payback-section-intro">
        <Link2 aria-hidden="true" />
        <span>
          Link this {entryKind} to money{" "}
          {entryKind === "expense" ? "received back" : "that it reimburses"}.
          You can leave this empty.
        </span>
      </div>
      <div className="payback-draft-grid">
        <FormField label={`Related ${targetLabel}`}>
          <select
            value={value.candidateId}
            disabled={disabled || !candidates?.length}
            onChange={(event) =>
              onChange({ ...value, candidateId: event.target.value })
            }
          >
            <option value="">Choose {targetLabel}</option>
            {candidates?.map((candidate) => (
              <option key={candidate._id} value={candidate._id}>
                {candidate.date} · {getCandidateName(candidate)} ·{" "}
                {formatMoney(candidate.amount)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Allocation amount">
          <input
            inputMode="decimal"
            value={value.allocatedAmount}
            disabled={disabled || !value.candidateId}
            placeholder="0.00"
            onChange={(event) =>
              onChange({ ...value, allocatedAmount: event.target.value })
            }
          />
        </FormField>
        <FormField label="Link note" optional>
          <input
            value={value.notes}
            disabled={disabled || !value.candidateId}
            placeholder="What is this reimbursement for?"
            onChange={(event) =>
              onChange({ ...value, notes: event.target.value })
            }
          />
        </FormField>
      </div>
      {!candidates?.length ? (
        <p className="payback-empty-note">
          There are no {targetLabel}s available to link yet.
        </p>
      ) : null}
    </DisclosureSection>
  );
}

export function ExpensePaybackLinkManager({ expenseId, disabled }: {
  expenseId: Id<"expenses">;
  disabled: boolean;
}) {
  const links = useQuery(api.paybackLinks.listForExpense, { expenseId });
  const candidates = useQuery(api.paybackLinks.listIncomingCandidates);
  const createLink = useMutation(api.paybackLinks.create);
  const updateLink = useMutation(api.paybackLinks.update);
  const removeLink = useMutation(api.paybackLinks.remove);
  const [incomingId, setIncomingId] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [warningText, setWarningText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [editingNotes, setEditingNotes] = useState("");

  const handleCreate = async () => {
    if (!incomingId || !allocatedAmount.trim()) return;
    const result = await createLink({
      expenseId,
      incomingId: incomingId as Id<"incomings">,
      allocatedAmount: toAmount(allocatedAmount),
      notes: notes || undefined,
    });
    setWarningText(formatWarnings(result));
    setIncomingId("");
    setAllocatedAmount("");
    setNotes("");
  };

  return (
    <DisclosureSection
      title="Paybacks"
      summary={links?.length ? `${links.length} linked` : "None linked"}
      defaultOpen={Boolean(links?.length)}
      className="payback-link-editor"
    >
      <p className="payback-helper">
        Link this expense to money you received back.
      </p>
      {links?.length ? (
        <div className="payback-link-list">
          {links.map((link) => {
            const isEditing = editingId === link._id;
            return (
              <div key={link._id} className="payback-link-row">
                <div className="payback-link-copy">
                  <strong>{link.incoming.incoming}</strong>
                  <span>
                    {formatMoney(link.allocatedAmount)}
                    {link.notes ? ` · ${link.notes}` : ""}
                  </span>
                </div>
                {isEditing ? (
                  <div className="payback-inline-edit">
                    <input
                      aria-label="Allocation amount"
                      value={editingAmount}
                      onChange={(event) => setEditingAmount(event.target.value)}
                    />
                    <input
                      aria-label="Link note"
                      value={editingNotes}
                      onChange={(event) => setEditingNotes(event.target.value)}
                    />
                    <button
                      type="button"
                      className="modal-button modal-button-primary compact"
                      disabled={disabled || !editingAmount.trim()}
                      onClick={() =>
                        void updateLink({
                          id: link._id,
                          allocatedAmount: toAmount(editingAmount),
                          notes: editingNotes || undefined,
                        }).then((result) => {
                          setWarningText(formatWarnings(result));
                          setEditingId(null);
                        })
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn"
                      aria-label="Cancel payback edit"
                      onClick={() => setEditingId(null)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="payback-link-actions">
                    <button
                      type="button"
                      className="icon-action-btn"
                      disabled={disabled}
                      aria-label="Edit payback"
                      onClick={() => {
                        setEditingId(link._id);
                        setEditingAmount(String(link.allocatedAmount));
                        setEditingNotes(link.notes ?? "");
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn danger"
                      disabled={disabled}
                      aria-label="Remove payback"
                      onClick={() => void removeLink({ id: link._id })}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="partner-editor-empty">No paybacks linked yet.</div>
      )}
      <div className="payback-link-form">
        <FormField label="Incoming">
          <select
            value={incomingId}
            disabled={disabled || !candidates?.length}
            onChange={(event) => setIncomingId(event.target.value)}
          >
            <option value="">Choose incoming</option>
            {candidates?.map((candidate) => (
              <option key={candidate._id} value={candidate._id}>
                {candidate.date} · {candidate.incoming} ·{" "}
                {formatMoney(candidate.amount)} raw /{" "}
                {formatMoney(getEffectiveAmount(candidate))} effective
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Allocation amount">
          <input
            value={allocatedAmount}
            disabled={disabled || !incomingId}
            placeholder="0.00"
            onChange={(event) => setAllocatedAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Link note" optional>
          <input
            value={notes}
            disabled={disabled || !incomingId}
            placeholder="What is this for?"
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        <button
          type="button"
          className="modal-button modal-button-secondary payback-link-button"
          disabled={disabled || !incomingId || !allocatedAmount.trim()}
          onClick={() => void handleCreate()}
        >
          Link payback
        </button>
      </div>
      {warningText ? (
        <div className="payback-link-warning">{warningText}</div>
      ) : null}
    </DisclosureSection>
  );
}

export function IncomingPaybackLinkManager({ incomingId, disabled }: {
  incomingId: Id<"incomings">;
  disabled: boolean;
}) {
  const links = useQuery(api.paybackLinks.listForIncoming, { incomingId });
  const candidates = useQuery(api.paybackLinks.listExpenseCandidates);
  const createLink = useMutation(api.paybackLinks.create);
  const updateLink = useMutation(api.paybackLinks.update);
  const removeLink = useMutation(api.paybackLinks.remove);
  const [expenseId, setExpenseId] = useState("");
  const [allocatedAmount, setAllocatedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [warningText, setWarningText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [editingNotes, setEditingNotes] = useState("");

  const handleCreate = async () => {
    if (!expenseId || !allocatedAmount.trim()) return;
    const result = await createLink({
      expenseId: expenseId as Id<"expenses">,
      incomingId,
      allocatedAmount: toAmount(allocatedAmount),
      notes: notes || undefined,
    });
    setWarningText(formatWarnings(result));
    setExpenseId("");
    setAllocatedAmount("");
    setNotes("");
  };

  return (
    <DisclosureSection
      title="Paybacks"
      summary={links?.length ? `${links.length} linked` : "None linked"}
      defaultOpen={Boolean(links?.length)}
      className="payback-link-editor"
    >
      <p className="payback-helper">
        Link this incoming to the expense it reimburses.
      </p>
      {links?.length ? (
        <div className="payback-link-list">
          {links.map((link) => {
            const isEditing = editingId === link._id;
            return (
              <div key={link._id} className="payback-link-row">
                <div className="payback-link-copy">
                  <strong>{link.expense.expense}</strong>
                  <span>
                    {formatMoney(link.allocatedAmount)}
                    {link.notes ? ` · ${link.notes}` : ""}
                  </span>
                </div>
                {isEditing ? (
                  <div className="payback-inline-edit">
                    <input
                      aria-label="Allocation amount"
                      value={editingAmount}
                      onChange={(event) => setEditingAmount(event.target.value)}
                    />
                    <input
                      aria-label="Link note"
                      value={editingNotes}
                      onChange={(event) => setEditingNotes(event.target.value)}
                    />
                    <button
                      type="button"
                      className="modal-button modal-button-primary compact"
                      disabled={disabled || !editingAmount.trim()}
                      onClick={() =>
                        void updateLink({
                          id: link._id,
                          allocatedAmount: toAmount(editingAmount),
                          notes: editingNotes || undefined,
                        }).then((result) => {
                          setWarningText(formatWarnings(result));
                          setEditingId(null);
                        })
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn"
                      aria-label="Cancel payback edit"
                      onClick={() => setEditingId(null)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="payback-link-actions">
                    <button
                      type="button"
                      className="icon-action-btn"
                      disabled={disabled}
                      aria-label="Edit payback"
                      onClick={() => {
                        setEditingId(link._id);
                        setEditingAmount(String(link.allocatedAmount));
                        setEditingNotes(link.notes ?? "");
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-action-btn danger"
                      disabled={disabled}
                      aria-label="Remove payback"
                      onClick={() => void removeLink({ id: link._id })}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="partner-editor-empty">No paybacks linked yet.</div>
      )}
      <div className="payback-link-form">
        <FormField label="Expense">
          <select
            value={expenseId}
            disabled={disabled || !candidates?.length}
            onChange={(event) => setExpenseId(event.target.value)}
          >
            <option value="">Choose expense</option>
            {candidates?.map((candidate) => (
              <option key={candidate._id} value={candidate._id}>
                {candidate.date} · {candidate.expense} ·{" "}
                {formatMoney(candidate.amount)} raw /{" "}
                {formatMoney(getEffectiveAmount(candidate))} effective
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Allocation amount">
          <input
            value={allocatedAmount}
            disabled={disabled || !expenseId}
            placeholder="0.00"
            onChange={(event) => setAllocatedAmount(event.target.value)}
          />
        </FormField>
        <FormField label="Link note" optional>
          <input
            value={notes}
            disabled={disabled || !expenseId}
            placeholder="What is this for?"
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
        <button
          type="button"
          className="modal-button modal-button-secondary payback-link-button"
          disabled={disabled || !expenseId || !allocatedAmount.trim()}
          onClick={() => void handleCreate()}
        >
          Link payback
        </button>
      </div>
      {warningText ? (
        <div className="payback-link-warning">{warningText}</div>
      ) : null}
    </DisclosureSection>
  );
}