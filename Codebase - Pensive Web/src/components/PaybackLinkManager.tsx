import { formatMoney, formatWarnings, getEffectiveAmount, toAmount } from "../helpers/formatters";
import type { Id } from "@pensive/convex-data-model";
import { useMutation, useQuery } from "convex/react";
import { api } from "@pensive/convex-api";
import { useState } from "react";

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

  const selectedIncomingId = incomingId || candidates?.[0]?._id || "";

  const handleCreate = async () => {
    if (!selectedIncomingId || !allocatedAmount.trim()) return;
    const result = await createLink({
      expenseId,
      incomingId: selectedIncomingId as Id<"incomings">,
      allocatedAmount: toAmount(allocatedAmount),
      notes: notes || undefined,
    });
    setWarningText(formatWarnings(result));
    setAllocatedAmount("");
    setNotes("");
  };

  return (
    <div className="payback-link-editor">
      <div className="partner-editor-header">Payback Links</div>
      {links?.length ? (
        <div className="partner-editor-list">
          {links.map((link) => (
            <div key={link._id} className="payback-link-row">
              <span>
                {link.incoming.incoming} · {formatMoney(link.allocatedAmount)}
                {link.notes ? ` · ${link.notes}` : ""}
              </span>
              <div className="payback-link-actions">
                <button
                  type="button"
                  className="icon-action-btn"
                  disabled={disabled}
                  onClick={() => {
                    const nextAmount = window.prompt(
                      "Allocated amount",
                      String(link.allocatedAmount),
                    );
                    if (!nextAmount) return;
                    const nextNotes = window.prompt("Notes", link.notes ?? "");
                    void updateLink({
                      id: link._id,
                      allocatedAmount: toAmount(nextAmount),
                      notes: nextNotes || undefined,
                    }).then((result) => setWarningText(formatWarnings(result)));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="icon-action-btn danger"
                  disabled={disabled}
                  onClick={() => void removeLink({ id: link._id })}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="partner-editor-empty">No payback links yet.</div>
      )}
      <div className="payback-link-form">
        <select
          value={selectedIncomingId}
          disabled={disabled || !candidates?.length}
          onChange={(event) => setIncomingId(event.target.value)}
        >
          {candidates?.map((candidate) => (
            <option key={candidate._id} value={candidate._id}>
              {candidate.date} · {candidate.incoming} ·{" "}
              {formatMoney(candidate.amount)} raw /{" "}
              {formatMoney(getEffectiveAmount(candidate))} effective
            </option>
          ))}
        </select>
        <input
          value={allocatedAmount}
          disabled={disabled || !candidates?.length}
          placeholder="Allocated amount"
          onChange={(event) => setAllocatedAmount(event.target.value)}
        />
        <input
          value={notes}
          disabled={disabled || !candidates?.length}
          placeholder="Link notes"
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="button"
          className="split-entry-launcher"
          disabled={disabled || !selectedIncomingId || !allocatedAmount.trim()}
          onClick={() => void handleCreate()}
        >
          Add Payback
        </button>
      </div>
      {warningText ? (
        <div className="payback-link-warning">{warningText}</div>
      ) : null}
    </div>
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

  const selectedExpenseId = expenseId || candidates?.[0]?._id || "";

  const handleCreate = async () => {
    if (!selectedExpenseId || !allocatedAmount.trim()) return;
    const result = await createLink({
      expenseId: selectedExpenseId as Id<"expenses">,
      incomingId,
      allocatedAmount: toAmount(allocatedAmount),
      notes: notes || undefined,
    });
    setWarningText(formatWarnings(result));
    setAllocatedAmount("");
    setNotes("");
  };

  return (
    <div className="payback-link-editor">
      <div className="partner-editor-header">Payback Links</div>
      {links?.length ? (
        <div className="partner-editor-list">
          {links.map((link) => (
            <div key={link._id} className="payback-link-row">
              <span>
                {link.expense.expense} · {formatMoney(link.allocatedAmount)}
                {link.notes ? ` · ${link.notes}` : ""}
              </span>
              <div className="payback-link-actions">
                <button
                  type="button"
                  className="icon-action-btn"
                  disabled={disabled}
                  onClick={() => {
                    const nextAmount = window.prompt(
                      "Allocated amount",
                      String(link.allocatedAmount),
                    );
                    if (!nextAmount) return;
                    const nextNotes = window.prompt("Notes", link.notes ?? "");
                    void updateLink({
                      id: link._id,
                      allocatedAmount: toAmount(nextAmount),
                      notes: nextNotes || undefined,
                    }).then((result) => setWarningText(formatWarnings(result)));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="icon-action-btn danger"
                  disabled={disabled}
                  onClick={() => void removeLink({ id: link._id })}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="partner-editor-empty">No payback links yet.</div>
      )}
      <div className="payback-link-form">
        <select
          value={selectedExpenseId}
          disabled={disabled || !candidates?.length}
          onChange={(event) => setExpenseId(event.target.value)}
        >
          {candidates?.map((candidate) => (
            <option key={candidate._id} value={candidate._id}>
              {candidate.date} · {candidate.expense} ·{" "}
              {formatMoney(candidate.amount)} raw /{" "}
              {formatMoney(getEffectiveAmount(candidate))} effective
            </option>
          ))}
        </select>
        <input
          value={allocatedAmount}
          disabled={disabled || !candidates?.length}
          placeholder="Allocated amount"
          onChange={(event) => setAllocatedAmount(event.target.value)}
        />
        <input
          value={notes}
          disabled={disabled || !candidates?.length}
          placeholder="Link notes"
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="button"
          className="split-entry-launcher"
          disabled={disabled || !selectedExpenseId || !allocatedAmount.trim()}
          onClick={() => void handleCreate()}
        >
          Add Payback
        </button>
      </div>
      {warningText ? (
        <div className="payback-link-warning">{warningText}</div>
      ) : null}
    </div>
  );
}