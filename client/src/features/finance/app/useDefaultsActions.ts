import { useEffect, useState } from "react";
import { requestJson } from "../../../lib/firebaseApi";
import { dedupe } from "../fallbacks";
import { pluralize } from "../utils";
import type {
  AuthUser,
  BillReference,
  DefaultAccount,
  DefaultCategory,
  DefaultExpenseKind,
  DefaultSubcategory,
  DefaultsOverview,
  Entry,
  EvenUpRecord,
  ImportantDate,
  RecurringRule,
} from "../types";

type UseDefaultsActionsOptions = {
  activeUsername: string | null;
  onRefresh: () => void;
  onRequireAuth: () => void;
};

type ImportSummary = {
  imported: {
    entries: number;
    accounts: number;
    categories: number;
    expenseKinds: number;
    recurringRules: number;
    importantDates: number;
    bills: number;
    evenUpRecords: number;
    notepad: number;
  };
};

export function useDefaultsActions({
  activeUsername,
  onRefresh,
  onRequireAuth,
}: UseDefaultsActionsOptions) {
  const [isDefaultsBusy, setIsDefaultsBusy] = useState(false);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [defaultsMessage, setDefaultsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeUsername) {
      return;
    }

    setIsDefaultsBusy(false);
    setDefaultsError(null);
    setDefaultsMessage(null);
  }, [activeUsername]);

  async function runDefaultsAction(action: () => Promise<void>) {
    setIsDefaultsBusy(true);
    setDefaultsError(null);
    setDefaultsMessage(null);

    try {
      await action();
      onRefresh();
    } catch (error) {
      setDefaultsError(
        error instanceof Error ? error.message : "Unable to update defaults.",
      );
    } finally {
      setIsDefaultsBusy(false);
    }
  }

  function requireAuthOrReturn() {
    if (!activeUsername) {
      onRequireAuth();
      return false;
    }

    return true;
  }

  function handleAddAccount() {
    if (!requireAuthOrReturn()) {
      return;
    }

    const name = window.prompt("New account name");

    if (!name?.trim()) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultAccount>(
        "/accounts",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Added account "${name.trim()}".`);
    });
  }

  function handleRenameAccount(account: DefaultAccount) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const nextName = window.prompt("Rename account", account.name);

    if (!nextName?.trim() || nextName.trim() === account.name) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultAccount>(
        `/accounts/${account.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: nextName.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Updated account to "${nextName.trim()}".`);
    });
  }

  function handleDeleteAccount(account: DefaultAccount) {
    if (!requireAuthOrReturn()) {
      return;
    }

    if (
      !window.confirm(`Delete "${account.name}" from your account defaults?`)
    ) {
      return;
    }

    const clearEntries =
      account.usageCount > 0
        ? window.confirm(
            `Also clear "${account.name}" from ${pluralize("entry", account.usageCount)}?`,
          )
        : false;

    void runDefaultsAction(async () => {
      await requestJson<{ deleted: true }>(
        `/accounts/${account.id}?clearEntries=${String(clearEntries)}`,
        { method: "DELETE" },
        activeUsername,
      );
      setDefaultsMessage(
        clearEntries
          ? `Deleted "${account.name}" and cleared it from existing entries.`
          : `Deleted "${account.name}" from defaults.`,
      );
    });
  }

  function handleAddCategory(type: "expense" | "income") {
    if (!requireAuthOrReturn()) {
      return;
    }

    const name = window.prompt(`New ${type} category name`);

    if (!name?.trim()) {
      return;
    }

    const subcategoriesInput = window.prompt(
      "Optional sub-categories (comma separated)",
      "",
    );
    const subcategories = dedupe(
      (subcategoriesInput ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );

    void runDefaultsAction(async () => {
      await requestJson<DefaultCategory>(
        "/categories",
        {
          method: "POST",
          body: JSON.stringify({
            type,
            name: name.trim(),
            subcategories,
          }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Added ${type} category "${name.trim()}".`);
    });
  }

  function handleRenameCategory(category: DefaultCategory) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const nextName = window.prompt("Rename category", category.name);

    if (!nextName?.trim() || nextName.trim() === category.name) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultCategory>(
        `/categories/${category.id}?type=${category.type}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: nextName.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Updated category to "${nextName.trim()}".`);
    });
  }

  function handleDeleteCategory(category: DefaultCategory) {
    if (!requireAuthOrReturn()) {
      return;
    }

    if (
      !window.confirm(
        `Delete "${category.name}" from ${category.type} defaults?`,
      )
    ) {
      return;
    }

    const clearEntries =
      category.usageCount > 0
        ? window.confirm(
            `Also clear "${category.name}" from ${pluralize("entry", category.usageCount)}?`,
          )
        : false;

    void runDefaultsAction(async () => {
      await requestJson<{ deleted: true }>(
        `/categories/${category.id}?type=${category.type}&clearEntries=${String(clearEntries)}`,
        { method: "DELETE" },
        activeUsername,
      );
      setDefaultsMessage(
        clearEntries
          ? `Deleted "${category.name}" and cleared it from existing entries.`
          : `Deleted "${category.name}" from defaults.`,
      );
    });
  }

  function handleAddSubcategory(category: DefaultCategory) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const name = window.prompt(`New sub-category for "${category.name}"`);

    if (!name?.trim()) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultSubcategory>(
        `/categories/${category.id}/subcategories?type=${category.type}`,
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Added sub-category "${name.trim()}".`);
    });
  }

  function handleRenameSubcategory(
    category: DefaultCategory,
    subcategory: DefaultSubcategory,
  ) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const nextName = window.prompt("Rename sub-category", subcategory.name);

    if (!nextName?.trim() || nextName.trim() === subcategory.name) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultSubcategory>(
        `/categories/${category.id}/subcategories/${subcategory.id}?type=${category.type}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: nextName.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Updated sub-category to "${nextName.trim()}".`);
    });
  }

  function handleDeleteSubcategory(
    category: DefaultCategory,
    subcategory: DefaultSubcategory,
  ) {
    if (!requireAuthOrReturn()) {
      return;
    }

    if (
      !window.confirm(
        `Delete "${subcategory.name}" from "${category.name}" ${category.type} defaults?`,
      )
    ) {
      return;
    }

    const clearEntries =
      subcategory.usageCount > 0
        ? window.confirm(
            `Also clear "${subcategory.name}" from ${pluralize(
              "entry",
              subcategory.usageCount,
            )}?`,
          )
        : false;

    void runDefaultsAction(async () => {
      await requestJson<{ deleted: true }>(
        `/categories/${category.id}/subcategories/${subcategory.id}?type=${category.type}&clearEntries=${String(clearEntries)}`,
        { method: "DELETE" },
        activeUsername,
      );
      setDefaultsMessage(
        clearEntries
          ? `Deleted "${subcategory.name}" and cleared it from existing entries.`
          : `Deleted "${subcategory.name}" from defaults.`,
      );
    });
  }

  function handleAddExpenseKind() {
    if (!requireAuthOrReturn()) {
      return;
    }

    const name = window.prompt("New expense kind");

    if (!name?.trim()) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultExpenseKind>(
        "/expense-kinds",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Added expense kind "${name.trim()}".`);
    });
  }

  function handleRenameExpenseKind(kind: DefaultExpenseKind) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const nextName = window.prompt("Rename expense kind", kind.name);

    if (!nextName?.trim() || nextName.trim() === kind.name) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultExpenseKind>(
        `/expense-kinds/${kind.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ name: nextName.trim() }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Updated expense kind to "${nextName.trim()}".`);
    });
  }

  function handleDeleteExpenseKind(kind: DefaultExpenseKind) {
    if (!requireAuthOrReturn()) {
      return;
    }

    if (!window.confirm(`Delete "${kind.name}" from your expense kinds?`)) {
      return;
    }

    const clearEntries =
      kind.usageCount > 0
        ? window.confirm(
            `Also clear "${kind.name}" from ${pluralize("entry", kind.usageCount)}?`,
          )
        : false;

    void runDefaultsAction(async () => {
      await requestJson<{ deleted: true }>(
        `/expense-kinds/${kind.id}?clearEntries=${String(clearEntries)}`,
        { method: "DELETE" },
        activeUsername,
      );
      setDefaultsMessage(
        clearEntries
          ? `Deleted "${kind.name}" and cleared it from existing entries.`
          : `Deleted "${kind.name}" from expense kinds.`,
      );
    });
  }

  function handleAddImportantDate() {
    if (!requireAuthOrReturn()) {
      return;
    }

    const name = window.prompt("Important date name");

    if (!name?.trim()) {
      return;
    }

    const date = window.prompt("Date (YYYY-MM-DD)");

    if (!date?.trim()) {
      return;
    }

    const notes = window.prompt("Optional note", "") ?? "";

    void runDefaultsAction(async () => {
      await requestJson<ImportantDate>(
        "/important-dates",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), date: date.trim(), notes }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Added important date "${name.trim()}".`);
    });
  }

  function handleRenameImportantDate(item: ImportantDate) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const nextName = window.prompt("Rename important date", item.name);

    if (!nextName?.trim()) {
      return;
    }

    const nextDate = window.prompt("Date (YYYY-MM-DD)", item.date);

    if (!nextDate?.trim()) {
      return;
    }

    const nextNotes = window.prompt("Optional note", item.notes ?? "") ?? "";

    void runDefaultsAction(async () => {
      await requestJson<ImportantDate>(
        `/important-dates/${item.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: nextName.trim(),
            date: nextDate.trim(),
            notes: nextNotes,
          }),
        },
        activeUsername,
      );
      setDefaultsMessage(`Updated important date "${nextName.trim()}".`);
    });
  }

  function handleDeleteImportantDate(item: ImportantDate) {
    if (!requireAuthOrReturn()) {
      return;
    }

    if (!window.confirm(`Delete "${item.name}"?`)) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<{ deleted: true }>(
        `/important-dates/${item.id}`,
        { method: "DELETE" },
        activeUsername,
      );
      setDefaultsMessage(`Deleted important date "${item.name}".`);
    });
  }

  function promptBillValues(initialBill?: BillReference) {
    const name = window.prompt("Bill name", initialBill?.name ?? "");

    if (!name?.trim()) {
      return null;
    }

    return {
      name: name.trim(),
      customerNumber:
        window.prompt("Customer number", initialBill?.customerNumber ?? "") ??
        "",
      consumerNumber:
        window.prompt("Consumer number", initialBill?.consumerNumber ?? "") ??
        "",
      meterNumber:
        window.prompt("Meter number", initialBill?.meterNumber ?? "") ?? "",
      contractAccount:
        window.prompt("Contract account", initialBill?.contractAccount ?? "") ??
        "",
      identityNumber:
        window.prompt("Identity number", initialBill?.identityNumber ?? "") ??
        "",
      notes: window.prompt("Notes", initialBill?.notes ?? "") ?? "",
    };
  }

  function handleAddBill() {
    if (!requireAuthOrReturn()) {
      return;
    }

    const bill = promptBillValues();

    if (!bill) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<BillReference>(
        "/bills",
        {
          method: "POST",
          body: JSON.stringify(bill),
        },
        activeUsername,
      );
      setDefaultsMessage(`Added bill "${bill.name}".`);
    });
  }

  function handleEditBill(bill: BillReference) {
    if (!requireAuthOrReturn()) {
      return;
    }

    const nextBill = promptBillValues(bill);

    if (!nextBill) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<BillReference>(
        `/bills/${bill.id}`,
        {
          method: "PUT",
          body: JSON.stringify(nextBill),
        },
        activeUsername,
      );
      setDefaultsMessage(`Updated bill "${nextBill.name}".`);
    });
  }

  function handleDeleteBill(bill: BillReference) {
    if (!requireAuthOrReturn()) {
      return;
    }

    if (!window.confirm(`Delete bill "${bill.name}"?`)) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<{ deleted: true }>(
        `/bills/${bill.id}`,
        { method: "DELETE" },
        activeUsername,
      );
      setDefaultsMessage(`Deleted bill "${bill.name}".`);
    });
  }

  function handleSaveNotepad(content: string) {
    if (!requireAuthOrReturn()) {
      return;
    }

    void runDefaultsAction(async () => {
      await requestJson<DefaultsOverview["notepad"]>(
        "/notepad",
        {
          method: "PUT",
          body: JSON.stringify({ content }),
        },
        activeUsername,
      );
      setDefaultsMessage("Saved notepad.");
    });
  }

  async function exportData() {
    if (!requireAuthOrReturn()) {
      return;
    }

    setDefaultsError(null);
    setDefaultsMessage(null);
    setIsDefaultsBusy(true);

    try {
      const [entries, defaults, profile, recurringRules, evenUpRecords] =
        await Promise.all([
          requestJson<Entry[]>("/entries", undefined, activeUsername),
          requestJson<DefaultsOverview>("/defaults", undefined, activeUsername),
          requestJson<AuthUser>("/profile", undefined, activeUsername),
          requestJson<RecurringRule[]>(
            "/recurring-rules",
            undefined,
            activeUsername,
          ),
          requestJson<EvenUpRecord[]>("/even-up", undefined, activeUsername),
        ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              username: activeUsername,
              profile: profile.profile,
              entries,
              defaults,
              recurringRules,
              evenUpRecords,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `finance-${activeUsername}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDefaultsMessage("Exported your current finance data.");
    } catch (error) {
      setDefaultsError(
        error instanceof Error ? error.message : "Unable to export data.",
      );
    } finally {
      setIsDefaultsBusy(false);
    }
  }

  function handleImportClick() {
    setDefaultsMessage(
      "Use the Import button in the top bar to choose a JSON backup.",
    );
  }

  async function importData(file: File) {
    if (!requireAuthOrReturn()) {
      return;
    }

    setDefaultsError(null);
    setDefaultsMessage(null);
    setIsDefaultsBusy(true);

    try {
      const parsed = JSON.parse(await file.text()) as {
        entries?: unknown[];
        defaults?: {
          accounts?: unknown[];
          categories?: {
            expense?: unknown[];
            income?: unknown[];
          };
          expenseKinds?: unknown[];
          importantDates?: unknown[];
          bills?: unknown[];
        };
        recurringRules?: unknown[];
        evenUpRecords?: unknown[];
      };
      const summary = {
        entries: parsed.entries?.length ?? 0,
        accounts: parsed.defaults?.accounts?.length ?? 0,
        categories:
          (parsed.defaults?.categories?.expense?.length ?? 0) +
          (parsed.defaults?.categories?.income?.length ?? 0),
        expenseKinds: parsed.defaults?.expenseKinds?.length ?? 0,
        recurringRules: parsed.recurringRules?.length ?? 0,
        importantDates: parsed.defaults?.importantDates?.length ?? 0,
        bills: parsed.defaults?.bills?.length ?? 0,
        evenUpRecords: parsed.evenUpRecords?.length ?? 0,
      };
      const confirmed = window.confirm(
        [
          "Import this finance backup?",
          "",
          `${summary.entries} entries`,
          `${summary.accounts} accounts`,
          `${summary.categories} categories`,
          `${summary.expenseKinds} expense kinds`,
          `${summary.recurringRules} recurring rules`,
          `${summary.importantDates} important dates`,
          `${summary.bills} bills`,
          `${summary.evenUpRecords} even-up records`,
          "",
          "Existing matching data will be kept.",
        ].join("\n"),
      );

      if (!confirmed) {
        setDefaultsMessage("Import cancelled.");
        return;
      }

      const result = await requestJson<ImportSummary>(
        "/import",
        {
          method: "POST",
          body: JSON.stringify(parsed),
        },
        activeUsername,
      );
      setDefaultsMessage(
        `Imported ${result.imported.entries} entries, ${result.imported.accounts} accounts, ${result.imported.categories} categories, and ${result.imported.recurringRules} recurring rules.`,
      );
      onRefresh();
    } catch (error) {
      setDefaultsError(
        error instanceof SyntaxError
          ? "Choose a valid JSON backup file."
          : error instanceof Error
            ? error.message
            : "Unable to import data.",
      );
    } finally {
      setIsDefaultsBusy(false);
    }
  }

  return {
    isDefaultsBusy,
    defaultsError,
    defaultsMessage,
    clearDefaultsStatus() {
      setDefaultsError(null);
      setDefaultsMessage(null);
    },
    handleAddAccount,
    handleRenameAccount,
    handleDeleteAccount,
    handleAddCategory,
    handleRenameCategory,
    handleDeleteCategory,
    handleAddSubcategory,
    handleRenameSubcategory,
    handleDeleteSubcategory,
    handleAddExpenseKind,
    handleRenameExpenseKind,
    handleDeleteExpenseKind,
    handleAddImportantDate,
    handleRenameImportantDate,
    handleDeleteImportantDate,
    handleAddBill,
    handleEditBill,
    handleDeleteBill,
    handleSaveNotepad,
    exportData,
    importData,
    handleImportClick,
  };
}
