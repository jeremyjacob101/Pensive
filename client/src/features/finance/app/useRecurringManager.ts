import { useEffect, useState } from "react";
import { requestJson } from "../../../lib/firebaseApi";
import {
  getDefaultCategory,
  getInitialEvenUpDraft,
  getInitialRecurringRuleDraft,
} from "../fallbacks";
import type {
  EvenUpDraft,
  EvenUpRecord,
  RecurringRule,
  RecurringRuleDraft,
  RecurringRunResult,
  ReferenceData,
} from "../types";

type UseRecurringManagerOptions = {
  activeUsername: string | null;
  referenceData: ReferenceData;
  availableExpenseKinds: string[];
  onRefresh: () => void;
  onRequireAuth: () => void;
};

function toRecurringDraft(rule: RecurringRule, availableExpenseKinds: string[]): RecurringRuleDraft {
  return {
    id: rule.id,
    type: rule.type,
    status: rule.status,
    name: rule.name,
    amount: String(rule.amount),
    frequency: rule.frequency,
    dayOfMonth: String(rule.dayOfMonth),
    account: rule.account ?? "",
    category: rule.category ?? "",
    entryKind:
      rule.type === "expense"
        ? rule.entryKind ?? availableExpenseKinds[0] ?? "Regular"
        : "",
    counterparty: rule.counterparty ?? "",
    notes: rule.notes ?? "",
    startDate: rule.startDate,
  };
}

export function useRecurringManager({
  activeUsername,
  referenceData,
  availableExpenseKinds,
  onRefresh,
  onRequireAuth,
}: UseRecurringManagerOptions) {
  const [recurringDraft, setRecurringDraft] = useState<RecurringRuleDraft | null>(null);
  const [isRecurringSaving, setIsRecurringSaving] = useState(false);
  const [evenUpDraft, setEvenUpDraft] = useState<EvenUpDraft | null>(null);
  const [isEvenUpSaving, setIsEvenUpSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeUsername) {
      return;
    }

    setRecurringDraft(null);
    setIsRecurringSaving(false);
    setEvenUpDraft(null);
    setIsEvenUpSaving(false);
    setActionError(null);
    setSaveMessage(null);
  }, [activeUsername]);

  function updateRecurringDraft<K extends keyof RecurringRuleDraft>(
    field: K,
    value: RecurringRuleDraft[K],
  ) {
    setRecurringDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      if (field === "type") {
        const nextType = value as RecurringRuleDraft["type"];
        return {
          ...currentDraft,
          type: nextType,
          category: getDefaultCategory(nextType, referenceData),
          entryKind:
            nextType === "expense" ? availableExpenseKinds[0] ?? "Regular" : "",
        };
      }

      return { ...currentDraft, [field]: value };
    });
  }

  function updateEvenUpDraft<K extends keyof EvenUpDraft>(
    field: K,
    value: EvenUpDraft[K],
  ) {
    setEvenUpDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, [field]: value } : currentDraft,
    );
  }

  function openRecurringEditor() {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    setActionError(null);
    setSaveMessage(null);
    setRecurringDraft(getInitialRecurringRuleDraft(referenceData));
  }

  function editRecurringRule(rule: RecurringRule) {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    setActionError(null);
    setSaveMessage(null);
    setRecurringDraft(toRecurringDraft(rule, availableExpenseKinds));
  }

  function cancelRecurringEditor() {
    setRecurringDraft(null);
  }

  async function saveRecurringRule() {
    if (!activeUsername || !recurringDraft) {
      return;
    }

    if (!recurringDraft.name.trim() || recurringDraft.amount.trim() === "") {
      setActionError("Name and amount are required.");
      return;
    }

    setIsRecurringSaving(true);
    setActionError(null);
    setSaveMessage(null);

    try {
      const payload = {
        type: recurringDraft.type,
        status: recurringDraft.status,
        name: recurringDraft.name.trim(),
        amount: Number(recurringDraft.amount),
        frequency: recurringDraft.frequency,
        dayOfMonth: Number(recurringDraft.dayOfMonth),
        account: recurringDraft.account.trim() || null,
        category: recurringDraft.category.trim() || null,
        entryKind:
          recurringDraft.type === "expense" ? recurringDraft.entryKind.trim() || null : null,
        counterparty: recurringDraft.counterparty.trim() || null,
        notes: recurringDraft.notes.trim() || null,
        startDate: recurringDraft.startDate,
      };

      const path = recurringDraft.id
        ? `/recurring-rules/${recurringDraft.id}`
        : "/recurring-rules";
      const method = recurringDraft.id ? "PUT" : "POST";
      const savedRule = await requestJson<RecurringRule>(
        path,
        { method, body: JSON.stringify(payload) },
        activeUsername,
      );

      setSaveMessage(
        `${savedRule.type === "income" ? "Income" : "Expense"} recurring rule ${
          recurringDraft.id ? "updated" : "saved"
        } for ${savedRule.name}.`,
      );
      setRecurringDraft(null);
      onRefresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to save recurring rule.",
      );
    } finally {
      setIsRecurringSaving(false);
    }
  }

  function deleteRecurringRule(rule: RecurringRule) {
    if (!activeUsername) {
      return;
    }

    if (!window.confirm(`Delete recurring rule "${rule.name}"?`)) {
      return;
    }

    void (async () => {
      setActionError(null);
      setSaveMessage(null);

      try {
        await requestJson<{ deleted: true }>(
          `/recurring-rules/${rule.id}`,
          { method: "DELETE" },
          activeUsername,
        );
        if (recurringDraft?.id === rule.id) {
          setRecurringDraft(null);
        }
        setSaveMessage(`Deleted recurring rule "${rule.name}".`);
        onRefresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Unable to delete recurring rule.",
        );
      }
    })();
  }

  function toggleRecurringRule(rule: RecurringRule) {
    if (!activeUsername) {
      return;
    }

    const nextStatus = rule.status === "add" ? "paused" : "add";

    void (async () => {
      setActionError(null);
      setSaveMessage(null);

      try {
        await requestJson<RecurringRule>(
          `/recurring-rules/${rule.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              status: nextStatus,
            }),
          },
          activeUsername,
        );
        if (recurringDraft?.id === rule.id) {
          setRecurringDraft((currentDraft) =>
            currentDraft ? { ...currentDraft, status: nextStatus } : currentDraft,
          );
        }
        setSaveMessage(
          `${nextStatus === "add" ? "Activated" : "Paused"} recurring rule "${rule.name}".`,
        );
        onRefresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Unable to update recurring rule.",
        );
      }
    })();
  }

  async function runRecurringNow() {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    setActionError(null);
    setSaveMessage(null);
    setIsRecurringSaving(true);

    try {
      const result = await requestJson<RecurringRunResult>(
        "/recurring-rules/run",
        { method: "POST" },
        activeUsername,
      );
      setSaveMessage(
        result.createdCount > 0
          ? `Generated ${result.createdCount} recurring entr${
              result.createdCount === 1 ? "y" : "ies"
            }.`
          : "No recurring entries were due right now.",
      );
      onRefresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to run recurring rules.",
      );
    } finally {
      setIsRecurringSaving(false);
    }
  }

  function openEvenUpEditor() {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    setActionError(null);
    setSaveMessage(null);
    setEvenUpDraft(getInitialEvenUpDraft());
  }

  function editEvenUpRecord(record: EvenUpRecord) {
    setActionError(null);
    setEvenUpDraft({
      id: record.id,
      status: record.status,
      startDate: record.startDate,
      endDate: record.endDate,
      paid: String(record.paid),
      from: record.from ?? "",
      to: record.to ?? "",
      notes: record.notes ?? "",
    });
  }

  function cancelEvenUpEditor() {
    setEvenUpDraft(null);
  }

  async function saveEvenUpRecord() {
    if (!activeUsername || !evenUpDraft) {
      return;
    }

    setIsEvenUpSaving(true);
    setActionError(null);
    setSaveMessage(null);

    try {
      const payload = {
        status: evenUpDraft.status,
        startDate: evenUpDraft.startDate,
        endDate: evenUpDraft.endDate,
        paid: Number(evenUpDraft.paid),
        from: evenUpDraft.from.trim() || null,
        to: evenUpDraft.to.trim() || null,
        notes: evenUpDraft.notes.trim() || null,
      };

      if (evenUpDraft.id) {
        await requestJson<EvenUpRecord>(
          `/even-up/${evenUpDraft.id}`,
          { method: "PUT", body: JSON.stringify(payload) },
          activeUsername,
        );
        setSaveMessage("Updated settlement.");
      } else {
        await requestJson<EvenUpRecord>(
          "/even-up",
          { method: "POST", body: JSON.stringify(payload) },
          activeUsername,
        );
        setSaveMessage("Added settlement.");
      }

      setEvenUpDraft(null);
      onRefresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to save settlement.",
      );
    } finally {
      setIsEvenUpSaving(false);
    }
  }

  function deleteEvenUpRecord(record: EvenUpRecord) {
    if (!activeUsername) {
      return;
    }

    if (!window.confirm(`Delete settlement "${record.code}"?`)) {
      return;
    }

    void (async () => {
      setActionError(null);
      setSaveMessage(null);

      try {
        await requestJson<{ deleted: true }>(
          `/even-up/${record.id}`,
          { method: "DELETE" },
          activeUsername,
        );
        setSaveMessage(`Deleted settlement "${record.code}".`);
        onRefresh();
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Unable to delete settlement.",
        );
      }
    })();
  }

  return {
    recurringDraft,
    isRecurringSaving,
    evenUpDraft,
    isEvenUpSaving,
    actionError,
    saveMessage,
    updateRecurringDraft,
    updateEvenUpDraft,
    openRecurringEditor,
    editRecurringRule,
    cancelRecurringEditor,
    clearRecurringStatus() {
      setActionError(null);
      setSaveMessage(null);
    },
    resetRecurringState() {
      setRecurringDraft(null);
      setIsRecurringSaving(false);
      setEvenUpDraft(null);
      setIsEvenUpSaving(false);
      setActionError(null);
      setSaveMessage(null);
    },
    saveRecurringRule,
    deleteRecurringRule,
    toggleRecurringRule,
    runRecurringNow,
    openEvenUpEditor,
    editEvenUpRecord,
    cancelEvenUpEditor,
    saveEvenUpRecord,
    deleteEvenUpRecord,
  };
}
