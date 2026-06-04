import type { Id } from "@pensive/convex-data-model";
import type { EditValues, FormType } from "./workspace";
import type { Dispatch, SetStateAction } from "react";
import type { OptionKind } from "./schema";
import type { MenuItemKey } from "./ui";

export type WorkspaceMutations = {
  createExpense: (args: {
    expense: string;
    account: string;
    category: string;
    subcategory?: string;
    amount: number;
    effectiveAmount?: number;
    effectiveAmountMode?: "auto" | "manual";
    monthYears?: string[];
    date: string;
    paidTo: string;
    notes?: string;
    comments?: string;
    expenseId: string;
    baseExpenseId?: string;
    subExpenseId?: string;
  }) => Promise<unknown>;
  createIncoming: (args: {
    incoming: string;
    paidBy: string;
    incomeType: string;
    incomeSubtype?: string;
    account: string;
    amount: number;
    effectiveAmount?: number;
    effectiveAmountMode?: "auto" | "manual";
    date: string;
    monthYears?: string[];
    notes?: string;
    comments?: string;
    incomingId: string;
    baseIncomingId?: string;
    subIncomingId?: string;
  }) => Promise<unknown>;
  createRecurring: (args: {
    status: string;
    kind: "expense" | "incoming";
    name: string;
    amount: number;
    frequency: string;
    dayOfMonth: number;
    recurringExpenseAccount?: string;
    recurringExpenseCategory?: string;
    recurringExpenseSubcategory?: string;
    recurringExpensePaidTo?: string;
    recurringIncomingPaidBy?: string;
    recurringIncomingType?: string;
    recurringIncomingSubtype?: string;
    recurringIncomingAccount?: string;
    notes?: string;
  }) => Promise<unknown>;
  addUserOption: (args: {
    kind: OptionKind;
    value: string;
    parentValue?: string;
  }) => Promise<unknown>;
  removeUserOption: (args: {
    kind: OptionKind;
    value: string;
    parentValue?: string;
  }) => Promise<unknown>;
  updateExpense: (args: {
    id: Id<"expenses">;
    expense: string;
    account: string;
    category: string;
    subcategory?: string;
    amount: number;
    effectiveAmount?: number;
    effectiveAmountMode?: "auto" | "manual";
    monthYears?: string[];
    date: string;
    paidTo: string;
    notes?: string;
    comments?: string;
    expenseId: string;
    baseExpenseId?: string;
    subExpenseId?: string;
    automationKey?: string;
  }) => Promise<unknown>;
  updateIncoming: (args: {
    id: Id<"incomings">;
    incoming: string;
    paidBy: string;
    incomeType: string;
    incomeSubtype?: string;
    account: string;
    amount: number;
    effectiveAmount?: number;
    effectiveAmountMode?: "auto" | "manual";
    date: string;
    monthYears?: string[];
    notes?: string;
    comments?: string;
    incomingId: string;
    baseIncomingId?: string;
    subIncomingId?: string;
  }) => Promise<unknown>;
  updateRecurring: (args: {
    id: Id<"recurrings">;
    status: string;
    kind: "expense" | "incoming";
    name: string;
    amount: number;
    frequency: string;
    dayOfMonth: number;
    recurringExpenseAccount?: string;
    recurringExpenseCategory?: string;
    recurringExpenseSubcategory?: string;
    recurringExpensePaidTo?: string;
    recurringIncomingPaidBy?: string;
    recurringIncomingType?: string;
    recurringIncomingSubtype?: string;
    recurringIncomingAccount?: string;
    notes?: string;
  }) => Promise<unknown>;
  deleteExpense: (args: { id: Id<"expenses"> }) => Promise<unknown>;
  deleteIncoming: (args: { id: Id<"incomings"> }) => Promise<unknown>;
  deleteRecurring: (args: { id: Id<"recurrings"> }) => Promise<unknown>;
};

export type WorkspaceState = {
  editValues: EditValues;
  setEditValues: Dispatch<SetStateAction<EditValues>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setFormType: Dispatch<SetStateAction<FormType>>;
  setEditingExpenseId: Dispatch<SetStateAction<string | null>>;
  setEditingIncomingId: Dispatch<SetStateAction<string | null>>;
  setEditingRecurringId: Dispatch<SetStateAction<string | null>>;
};

export type WorkspaceConfig = {
  onSelectTab: (tab: MenuItemKey) => void;
};