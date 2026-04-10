import { useEffect, useState } from "react";
import { requestJson } from "../../../lib/firebaseApi";
import {
  getDefaultCategory,
  getInitialEvenUpDraft,
} from "../fallbacks";
import type {
  EvenUpDraft,
  EvenUpRecord,
  RecurringRule,
  RecurringRuleDraft,
  ReferenceData,
} from "../types";

type UseRecurringManagerOptions = {
  activeUsername: string | null;
  referenceData: ReferenceData;
  availableExpenseKinds: string[];
  onRefresh: () => void;
  onRequireAuth: () => void;
};

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

    setActionError("Recurring rules are display-only right now.");
    setSaveMessage(null);
  }

  function editRecurringRule(rule: RecurringRule) {
    void rule;
    setActionError("Recurring rules are display-only right now.");
    setSaveMessage(null);
  }

  function cancelRecurringEditor() {
    setRecurringDraft(null);
  }

  async function saveRecurringRule() {
    if (!activeUsername) {
      return;
    }

    setRecurringDraft(null);
    setIsRecurringSaving(false);
    setActionError("Recurring rules are display-only right now.");
    setSaveMessage(null);
  }

  function deleteRecurringRule(rule: RecurringRule) {
    void rule;
    if (!activeUsername) {
      return;
    }

    setActionError("Recurring rules are display-only right now.");
    setSaveMessage(null);
  }

  async function runRecurringNow() {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    setActionError("Recurring rules are display-only right now.");
    setSaveMessage(null);
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
    runRecurringNow,
    openEvenUpEditor,
    editEvenUpRecord,
    cancelEvenUpEditor,
    saveEvenUpRecord,
    deleteEvenUpRecord,
  };
}
