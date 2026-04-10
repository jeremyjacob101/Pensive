import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { requestJson } from "../../../lib/firebaseApi";
import {
  dedupe,
  fallbackReferenceData,
  getDefaultAccount,
  getDefaultCategory,
  getInitialDraft,
} from "../fallbacks";
import type { Draft, Entry, EntryType, ReferenceData } from "../types";

type UseEntryComposerOptions = {
  activeUsername: string | null;
  referenceData: ReferenceData;
  onRequireAuth: () => void;
  onRefresh: () => void;
  selectedMonth: string;
  setSelectedMonth: Dispatch<SetStateAction<string>>;
};

function toDraft(entry: Entry, referenceData: ReferenceData): Draft {
  return {
    type: entry.type,
    name: entry.name,
    amount: String(entry.amount),
    category: entry.category ?? getDefaultCategory(entry.type, referenceData),
    subcategory: entry.subcategory ?? "",
    date: entry.date,
    account: entry.account ?? getDefaultAccount(referenceData),
    notes: entry.notes ?? "",
    entryKind: entry.entryKind ?? (entry.type === "expense" ? "Regular" : ""),
    counterparty: entry.counterparty ?? "",
    comments: entry.comments ?? "",
    allocationMonthsText:
      entry.type === "income"
        ? entry.allocationMonths.join(", ")
        : entry.allocationMonths[0] ?? "",
  };
}

export function useEntryComposer({
  activeUsername,
  referenceData,
  onRequireAuth,
  onRefresh,
  selectedMonth,
  setSelectedMonth,
}: UseEntryComposerOptions) {
  const composerCloseTimeoutRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<Draft>(() =>
    getInitialDraft("expense", fallbackReferenceData),
  );
  const [activeComposer, setActiveComposer] = useState<EntryType | null>(null);
  const [closingComposer, setClosingComposer] = useState<EntryType | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isEntrySaving, setIsEntrySaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft((currentDraft) => {
      const nextCategories = dedupe([
        ...referenceData.categories[currentDraft.type],
        ...fallbackReferenceData.categories[currentDraft.type],
      ]);
      const nextAccounts = dedupe([
        ...referenceData.accounts,
        ...fallbackReferenceData.accounts,
      ]);
      const nextExpenseKinds = dedupe([
        ...referenceData.expenseKinds,
        ...fallbackReferenceData.expenseKinds,
      ]);
      const nextSubcategories = dedupe([
        ...(referenceData.subcategories[currentDraft.type][currentDraft.category] ?? []),
        ...(fallbackReferenceData.subcategories[currentDraft.type][currentDraft.category] ?? []),
      ]);

      return {
        ...currentDraft,
        category: nextCategories.includes(currentDraft.category)
          ? currentDraft.category
          : getDefaultCategory(currentDraft.type, referenceData),
        subcategory: nextSubcategories.includes(currentDraft.subcategory)
          ? currentDraft.subcategory
          : "",
        account: nextAccounts.includes(currentDraft.account)
          ? currentDraft.account
          : getDefaultAccount(referenceData),
        entryKind: nextExpenseKinds.includes(currentDraft.entryKind)
          ? currentDraft.entryKind
          : referenceData.expenseKinds[0] ??
            fallbackReferenceData.expenseKinds[0] ??
            "Regular",
      };
    });
  }, [referenceData]);

  useEffect(() => {
    if (activeUsername) {
      return;
    }

    if (composerCloseTimeoutRef.current !== null) {
      window.clearTimeout(composerCloseTimeoutRef.current);
      composerCloseTimeoutRef.current = null;
    }

    setDraft(getInitialDraft("expense", fallbackReferenceData));
    setActiveComposer(null);
    setClosingComposer(null);
    setEditingEntryId(null);
    setIsEntrySaving(false);
    setSaveError(null);
    setSaveMessage(null);
  }, [activeUsername]);

  useEffect(() => {
    return () => {
      if (composerCloseTimeoutRef.current !== null) {
        window.clearTimeout(composerCloseTimeoutRef.current);
      }
    };
  }, []);

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function openComposer(type: EntryType) {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    if (composerCloseTimeoutRef.current !== null) {
      window.clearTimeout(composerCloseTimeoutRef.current);
      composerCloseTimeoutRef.current = null;
    }

    setSaveError(null);
    setSaveMessage(null);
    setClosingComposer(null);
    setEditingEntryId(null);
    setActiveComposer(type);
    setDraft((currentDraft) => ({
      ...getInitialDraft(type, referenceData),
      date: currentDraft.date,
    }));
  }

  function editEntry(entry: Entry) {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    if (composerCloseTimeoutRef.current !== null) {
      window.clearTimeout(composerCloseTimeoutRef.current);
      composerCloseTimeoutRef.current = null;
    }

    setSaveError(null);
    setSaveMessage(null);
    setClosingComposer(null);
    setEditingEntryId(entry.id);
    setActiveComposer(entry.type);
    setDraft(toDraft(entry, referenceData));
  }

  function closeComposer() {
    if (!activeComposer) {
      return;
    }

    setClosingComposer(activeComposer);
    setActiveComposer(null);
    setEditingEntryId(null);
    setSaveError(null);

    if (composerCloseTimeoutRef.current !== null) {
      window.clearTimeout(composerCloseTimeoutRef.current);
    }

    composerCloseTimeoutRef.current = window.setTimeout(() => {
      setClosingComposer(null);
      composerCloseTimeoutRef.current = null;
    }, 280);
  }

  async function saveEntry() {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    if (!draft.name.trim() || draft.amount.trim() === "") {
      setSaveError("Name and amount are required.");
      return;
    }

    setIsEntrySaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const path = editingEntryId ? `/entries/${editingEntryId}` : "/entries";
      const method = editingEntryId ? "PUT" : "POST";
      const savedEntry = await requestJson<Entry>(
        path,
        {
          method,
          body: JSON.stringify({
            type: draft.type,
            name: draft.name.trim(),
            amount: Number(draft.amount),
            category: draft.category || null,
            subcategory: draft.subcategory.trim() || null,
            date: draft.date,
            account: draft.account || null,
            notes: draft.notes.trim() || null,
            entryKind: draft.type === "expense" ? draft.entryKind || null : null,
            counterparty: draft.counterparty.trim() || null,
            comments: draft.comments.trim() || null,
            allocationMonths:
              draft.type === "income"
                ? dedupe(
                    draft.allocationMonthsText
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                : null,
          }),
        },
        activeUsername,
      );

      setSaveMessage(
        `${savedEntry.type === "expense" ? "Expense" : "Income"} ${
          editingEntryId ? "updated" : "saved"
        } for ${savedEntry.name}.`,
      );
      setDraft(getInitialDraft(savedEntry.type, referenceData));
      setActiveComposer(null);
      setEditingEntryId(null);
      onRefresh();

      const nextMonth = savedEntry.date.slice(0, 7);
      if (nextMonth !== selectedMonth) {
        setSelectedMonth(nextMonth);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save entry.",
      );
    } finally {
      setIsEntrySaving(false);
    }
  }

  async function deleteEntry(entry: Entry) {
    if (!activeUsername) {
      onRequireAuth();
      return;
    }

    if (!window.confirm(`Delete ${entry.type} "${entry.name}"?`)) {
      return;
    }

    setIsEntrySaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      await requestJson<{ deleted: true }>(
        `/entries/${entry.id}`,
        { method: "DELETE" },
        activeUsername,
      );
      setSaveMessage(
        `${entry.type === "expense" ? "Expense" : "Income"} deleted for ${entry.name}.`,
      );
      if (editingEntryId === entry.id) {
        setDraft(getInitialDraft(entry.type, referenceData));
        setActiveComposer(null);
        setEditingEntryId(null);
      }
      onRefresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to delete entry.",
      );
    } finally {
      setIsEntrySaving(false);
    }
  }

  return {
    draft,
    activeComposer,
    closingComposer,
    visibleComposer: activeComposer ?? closingComposer,
    isEditing: Boolean(editingEntryId),
    isEntrySaving,
    saveError,
    saveMessage,
    updateDraft,
    openComposer,
    editEntry,
    deleteEntry,
    closeComposer,
    resetComposerState() {
      if (composerCloseTimeoutRef.current !== null) {
        window.clearTimeout(composerCloseTimeoutRef.current);
        composerCloseTimeoutRef.current = null;
      }

      setDraft(getInitialDraft("expense", referenceData));
      setActiveComposer(null);
      setClosingComposer(null);
      setEditingEntryId(null);
      setIsEntrySaving(false);
      setSaveError(null);
      setSaveMessage(null);
    },
    saveEntry,
  };
}
