import { getMonthFromIsoDate, parseMonthYears } from "../helpers/dates";
import type { Dispatch, SetStateAction, SyntheticEvent } from "react";
import type { WorkspaceMutations } from "../types/workspaceActions";
import type { EditValues, FormType } from "../types/workspace";
import { randomId16, toAmount } from "../helpers/formatters";
import type { Doc } from "@pensive/convex-data-model";
import type { OptionKind } from "../types/schema";

export async function saveOption(
  addUserOption: WorkspaceMutations["addUserOption"],
  kind: OptionKind,
  value: string,
  parentValue?: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return;
  await addUserOption({
    kind,
    value: trimmed,
    parentValue: parentValue?.trim() || undefined,
  });
}

export async function handleAddExpense(
  e: SyntheticEvent<HTMLFormElement>,
  deps: {
    createExpense: WorkspaceMutations["createExpense"];
    addUserOption: WorkspaceMutations["addUserOption"];
    setSaving: Dispatch<SetStateAction<boolean>>;
    setFormType: Dispatch<SetStateAction<FormType>>;
    onSelectTab: (
      tab: "expenses" | "incomings" | "recurrings" | "options",
    ) => void;
  },
) {
  e.preventDefault();
  const formElement = e.currentTarget;
  const form = new FormData(formElement);
  const monthYears = parseMonthYears(
    String(form.get("monthYears") ?? "[]"),
    "",
  );
  if (monthYears.length === 0) return null;
  deps.setSaving(true);
  try {
    const date = String(form.get("date") ?? "");
    const effectiveAmountMode =
      String(form.get("effectiveAmountMode") ?? "auto") === "manual"
        ? "manual"
        : "auto";
    const createdId = await deps.createExpense({
      expense: String(form.get("expense") ?? ""),
      account: String(form.get("account") ?? ""),
      category: String(form.get("category") ?? ""),
      subcategory: String(form.get("subcategory") ?? "") || undefined,
      amount: toAmount(String(form.get("amount") ?? "")),
      effectiveAmount:
        effectiveAmountMode === "manual"
          ? toAmount(String(form.get("effectiveAmount") ?? ""))
          : undefined,
      effectiveAmountMode,
      monthYears,
      date,
      paidTo: String(form.get("paidTo") ?? ""),
      notes: String(form.get("notes") ?? "") || undefined,
      comments: String(form.get("comments") ?? "") || undefined,
      expenseId: randomId16(),
    });
    await Promise.all([
      saveOption(
        deps.addUserOption,
        "account",
        String(form.get("account") ?? ""),
      ),
      saveOption(
        deps.addUserOption,
        "category",
        String(form.get("category") ?? ""),
      ),
      saveOption(
        deps.addUserOption,
        "subcategory",
        String(form.get("subcategory") ?? ""),
        String(form.get("category") ?? ""),
      ),
    ]);
    formElement.reset();
    deps.setFormType(null);
    deps.onSelectTab("expenses");
    return createdId;
  } finally {
    deps.setSaving(false);
  }
}

export async function handleAddIncoming(
  e: SyntheticEvent<HTMLFormElement>,
  deps: {
    createIncoming: WorkspaceMutations["createIncoming"];
    addUserOption: WorkspaceMutations["addUserOption"];
    setSaving: Dispatch<SetStateAction<boolean>>;
    setFormType: Dispatch<SetStateAction<FormType>>;
    onSelectTab: (
      tab: "expenses" | "incomings" | "recurrings" | "options",
    ) => void;
  },
) {
  e.preventDefault();
  const formElement = e.currentTarget;
  const form = new FormData(formElement);
  const monthYears = parseMonthYears(
    String(form.get("monthYears") ?? "[]"),
    "",
  );
  if (monthYears.length === 0) return null;
  deps.setSaving(true);
  try {
    const date = String(form.get("date") ?? "");
    const effectiveAmountMode =
      String(form.get("effectiveAmountMode") ?? "auto") === "manual"
        ? "manual"
        : "auto";
    const createdId = await deps.createIncoming({
      incoming: String(form.get("incoming") ?? ""),
      paidBy: String(form.get("paidBy") ?? ""),
      incomeType: String(form.get("incomeType") ?? ""),
      incomeSubtype: String(form.get("incomeSubtype") ?? "") || undefined,
      account: String(form.get("account") ?? ""),
      amount: toAmount(String(form.get("amount") ?? "")),
      effectiveAmount:
        effectiveAmountMode === "manual"
          ? toAmount(String(form.get("effectiveAmount") ?? ""))
          : undefined,
      effectiveAmountMode,
      date,
      monthYears,
      notes: String(form.get("notes") ?? "") || undefined,
      comments: String(form.get("comments") ?? "") || undefined,
      incomingId: randomId16(),
    });
    await Promise.all([
      saveOption(
        deps.addUserOption,
        "incomeType",
        String(form.get("incomeType") ?? ""),
      ),
      saveOption(
        deps.addUserOption,
        "account",
        String(form.get("account") ?? ""),
      ),
      saveOption(
        deps.addUserOption,
        "incomeSubtype",
        String(form.get("incomeSubtype") ?? ""),
        String(form.get("incomeType") ?? ""),
      ),
    ]);
    formElement.reset();
    deps.setFormType(null);
    deps.onSelectTab("incomings");
    return createdId;
  } finally {
    deps.setSaving(false);
  }
}

export async function handleAddRecurring(
  e: SyntheticEvent<HTMLFormElement>,
  deps: {
    createRecurring: WorkspaceMutations["createRecurring"];
    setSaving: Dispatch<SetStateAction<boolean>>;
    setFormType: Dispatch<SetStateAction<FormType>>;
    onSelectTab: (
      tab: "expenses" | "incomings" | "recurrings" | "options",
    ) => void;
  },
) {
  e.preventDefault();
  const formElement = e.currentTarget;
  const form = new FormData(formElement);
  const kind =
    String(form.get("kind") ?? "expense") === "incoming"
      ? "incoming"
      : "expense";
  const dayOfMonth = Number(String(form.get("dayOfMonth") ?? "0")) || 0;
  if (
    kind === "expense" &&
    dayOfMonth > 28 &&
    !window.confirm(
      `Day ${dayOfMonth} recurring expenses will not apply in months with fewer than ${dayOfMonth} days. Still create?`,
    )
  ) {
    return;
  }
  deps.setSaving(true);
  try {
    await deps.createRecurring({
      status:
        String(form.get("status") ?? "active") === "inactive"
          ? "inactive"
          : "active",
      kind,
      name: String(form.get("name") ?? ""),
      amount: toAmount(String(form.get("amount") ?? "")),
      frequency: "Monthly",
      dayOfMonth,
      recurringExpenseAccount:
        kind === "expense"
          ? String(form.get("recurringExpenseAccount") ?? "")
          : undefined,
      recurringExpenseCategory:
        kind === "expense"
          ? String(form.get("recurringExpenseCategory") ?? "")
          : undefined,
      recurringExpenseSubcategory:
        kind === "expense"
          ? String(form.get("recurringExpenseSubcategory") ?? "") || undefined
          : undefined,
      recurringExpensePaidTo:
        kind === "expense"
          ? String(form.get("recurringExpensePaidTo") ?? "")
          : undefined,
      recurringIncomingPaidBy:
        kind === "incoming"
          ? String(form.get("recurringIncomingPaidBy") ?? "")
          : undefined,
      recurringIncomingType:
        kind === "incoming"
          ? String(form.get("recurringIncomingType") ?? "")
          : undefined,
      recurringIncomingSubtype:
        kind === "incoming"
          ? String(form.get("recurringIncomingSubtype") ?? "") || undefined
          : undefined,
      recurringIncomingAccount:
        kind === "incoming"
          ? String(form.get("recurringIncomingAccount") ?? "")
          : undefined,
      notes: String(form.get("notes") ?? "") || undefined,
    });
    formElement.reset();
    deps.setFormType(null);
    deps.onSelectTab("recurrings");
  } finally {
    deps.setSaving(false);
  }
}

export function handleStartEditExpense(
  row: Doc<"expenses">,
  setEditingExpenseId: Dispatch<SetStateAction<string | null>>,
  setEditValues: Dispatch<SetStateAction<EditValues>>,
) {
  setEditingExpenseId(row._id);
  setEditValues({
    expense: row.expense,
    account: row.account,
    category: row.category,
    subcategory: row.subcategory ?? "",
    amount: String(row.amount),
    effectiveAmount: String(row.effectiveAmount ?? row.amount),
    effectiveAmountMode: row.effectiveAmountMode ?? "auto",
    date: row.date,
    monthYears: JSON.stringify(
      row.monthYears ?? [getMonthFromIsoDate(row.date)],
    ),
    paidTo: row.paidTo,
    notes: row.notes ?? "",
    comments: row.comments ?? "",
    expenseId: row.expenseId,
  });
}

export function handleStartEditIncoming(
  row: Doc<"incomings">,
  setEditingIncomingId: Dispatch<SetStateAction<string | null>>,
  setEditValues: Dispatch<SetStateAction<EditValues>>,
) {
  setEditingIncomingId(row._id);
  setEditValues({
    incoming: row.incoming,
    paidBy: row.paidBy,
    incomeType: row.incomeType,
    incomeSubtype: row.incomeSubtype ?? "",
    account: row.account,
    amount: String(row.amount),
    effectiveAmount: String(row.effectiveAmount ?? row.amount),
    effectiveAmountMode: row.effectiveAmountMode ?? "auto",
    date: row.date,
    monthYears: JSON.stringify(
      row.monthYears ?? [getMonthFromIsoDate(row.date)],
    ),
    notes: row.notes ?? "",
    comments: row.comments ?? "",
    incomingId: row.incomingId,
  });
}

export function handleStartEditRecurring(
  row: Doc<"recurrings">,
  setEditingRecurringId: Dispatch<SetStateAction<string | null>>,
  setEditValues: Dispatch<SetStateAction<EditValues>>,
) {
  setEditingRecurringId(row._id);
  setEditValues({
    status: row.status,
    kind: row.kind ?? "expense",
    name: row.name,
    amount: String(row.amount),
    frequency: row.frequency,
    dayOfMonth: String(row.dayOfMonth),
    recurringExpenseAccount: row.recurringExpenseAccount ?? "",
    recurringExpenseCategory: row.recurringExpenseCategory ?? "",
    recurringExpenseSubcategory: row.recurringExpenseSubcategory ?? "",
    recurringExpensePaidTo: row.recurringExpensePaidTo ?? "",
    recurringIncomingPaidBy: row.recurringIncomingPaidBy ?? "",
    recurringIncomingType: row.recurringIncomingType ?? "",
    recurringIncomingSubtype: row.recurringIncomingSubtype ?? "",
    recurringIncomingAccount: row.recurringIncomingAccount ?? "",
    notes: row.notes ?? "",
  });
}

export async function handleUpdateExpense(
  row: Doc<"expenses">,
  deps: {
    updateExpense: WorkspaceMutations["updateExpense"];
    editValues: EditValues;
    setSaving: Dispatch<SetStateAction<boolean>>;
    setEditingExpenseId: Dispatch<SetStateAction<string | null>>;
  },
) {
  const monthYears = parseMonthYears(deps.editValues.monthYears, "");
  if (monthYears.length === 0) return;
  deps.setSaving(true);
  try {
    await deps.updateExpense({
      id: row._id,
      expense: deps.editValues.expense ?? "",
      account: deps.editValues.account ?? "",
      category: deps.editValues.category ?? "",
      subcategory: deps.editValues.subcategory || undefined,
      amount: toAmount(deps.editValues.amount ?? ""),
      effectiveAmount:
        deps.editValues.effectiveAmountMode === "manual"
          ? toAmount(deps.editValues.effectiveAmount ?? "")
          : undefined,
      effectiveAmountMode:
        deps.editValues.effectiveAmountMode === "manual" ? "manual" : "auto",
      monthYears,
      date: deps.editValues.date ?? "",
      paidTo: deps.editValues.paidTo ?? "",
      notes: deps.editValues.notes || undefined,
      comments: deps.editValues.comments || undefined,
      expenseId: deps.editValues.expenseId ?? "",
      baseExpenseId: row.baseExpenseId ?? undefined,
    });
    deps.setEditingExpenseId(null);
  } finally {
    deps.setSaving(false);
  }
}

export async function handleDeleteExpense(
  row: Doc<"expenses">,
  deleteExpense: WorkspaceMutations["deleteExpense"],
  setSaving: Dispatch<SetStateAction<boolean>>,
) {
  setSaving(true);
  try {
    await deleteExpense({ id: row._id });
  } finally {
    setSaving(false);
  }
}

export async function handleUpdateIncoming(
  row: Doc<"incomings">,
  deps: {
    updateIncoming: WorkspaceMutations["updateIncoming"];
    editValues: EditValues;
    setSaving: Dispatch<SetStateAction<boolean>>;
    setEditingIncomingId: Dispatch<SetStateAction<string | null>>;
  },
) {
  const monthYears = parseMonthYears(deps.editValues.monthYears, "");
  if (monthYears.length === 0) return;
  deps.setSaving(true);
  try {
    await deps.updateIncoming({
      id: row._id,
      incoming: deps.editValues.incoming ?? "",
      paidBy: deps.editValues.paidBy ?? "",
      incomeType: deps.editValues.incomeType ?? "",
      incomeSubtype: deps.editValues.incomeSubtype || undefined,
      account: deps.editValues.account ?? "",
      amount: toAmount(deps.editValues.amount ?? ""),
      effectiveAmount:
        deps.editValues.effectiveAmountMode === "manual"
          ? toAmount(deps.editValues.effectiveAmount ?? "")
          : undefined,
      effectiveAmountMode:
        deps.editValues.effectiveAmountMode === "manual" ? "manual" : "auto",
      date: deps.editValues.date ?? "",
      monthYears,
      notes: deps.editValues.notes || undefined,
      comments: deps.editValues.comments || undefined,
      incomingId: deps.editValues.incomingId ?? "",
      baseIncomingId: row.baseIncomingId ?? undefined,
    });
    deps.setEditingIncomingId(null);
  } finally {
    deps.setSaving(false);
  }
}

export async function handleDeleteIncoming(
  row: Doc<"incomings">,
  deleteIncoming: WorkspaceMutations["deleteIncoming"],
  setSaving: Dispatch<SetStateAction<boolean>>,
) {
  setSaving(true);
  try {
    await deleteIncoming({ id: row._id });
  } finally {
    setSaving(false);
  }
}

export async function handleUpdateRecurring(
  row: Doc<"recurrings">,
  deps: {
    updateRecurring: WorkspaceMutations["updateRecurring"];
    editValues: EditValues;
    setSaving: Dispatch<SetStateAction<boolean>>;
    setEditingRecurringId: Dispatch<SetStateAction<string | null>>;
  },
) {
  const kind = deps.editValues.kind === "incoming" ? "incoming" : "expense";
  const dayOfMonth = Number(deps.editValues.dayOfMonth ?? "0") || 0;
  if (
    kind === "expense" &&
    dayOfMonth > 28 &&
    !window.confirm(
      `Day ${dayOfMonth} recurring expenses will not apply in months with fewer than ${dayOfMonth} days. Still save?`,
    )
  ) {
    return;
  }
  deps.setSaving(true);
  try {
    await deps.updateRecurring({
      id: row._id,
      status: deps.editValues.status === "inactive" ? "inactive" : "active",
      kind,
      name: deps.editValues.name ?? "",
      amount: toAmount(deps.editValues.amount ?? ""),
      frequency: row.frequency || "Monthly",
      dayOfMonth,
      recurringExpenseAccount:
        kind === "expense"
          ? (deps.editValues.recurringExpenseAccount ?? "")
          : undefined,
      recurringExpenseCategory:
        kind === "expense"
          ? (deps.editValues.recurringExpenseCategory ?? "")
          : undefined,
      recurringExpenseSubcategory:
        kind === "expense"
          ? deps.editValues.recurringExpenseSubcategory || undefined
          : undefined,
      recurringExpensePaidTo:
        kind === "expense"
          ? (deps.editValues.recurringExpensePaidTo ?? "")
          : undefined,
      recurringIncomingPaidBy:
        kind === "incoming"
          ? (deps.editValues.recurringIncomingPaidBy ?? "")
          : undefined,
      recurringIncomingType:
        kind === "incoming"
          ? (deps.editValues.recurringIncomingType ?? "")
          : undefined,
      recurringIncomingSubtype:
        kind === "incoming"
          ? deps.editValues.recurringIncomingSubtype || undefined
          : undefined,
      recurringIncomingAccount:
        kind === "incoming"
          ? (deps.editValues.recurringIncomingAccount ?? "")
          : undefined,
      notes: deps.editValues.notes || undefined,
    });
    deps.setEditingRecurringId(null);
  } finally {
    deps.setSaving(false);
  }
}

export async function handleDeleteRecurring(
  row: Doc<"recurrings">,
  deleteRecurring: WorkspaceMutations["deleteRecurring"],
  setSaving: Dispatch<SetStateAction<boolean>>,
) {
  setSaving(true);
  try {
    await deleteRecurring({ id: row._id });
  } finally {
    setSaving(false);
  }
}
