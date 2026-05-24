import { DATE_STATE_KEY, EXPENSE_ACCOUNT_DESELECTED_KEY, EXPENSE_CATEGORY_DESELECTED_KEY, EXPENSE_TYPE_DESELECTED_KEY, INCOMING_ACCOUNT_DESELECTED_KEY, INCOMING_TYPE_DESELECTED_KEY } from "../keys/breakdown";

export type PersistedDateState = {
  mode?: "month" | "custom";
  activeMonth?: string | null;
  customStart?: string;
  customEnd?: string;
};

export type ParsedDateState = {
  mode: "month" | "custom";
  activeMonth: string | null;
  customRange: { startDate: string; endDate: string } | null;
};

export const BREAKDOWN_STORAGE_KEYS = [
  DATE_STATE_KEY,
  EXPENSE_ACCOUNT_DESELECTED_KEY,
  INCOMING_ACCOUNT_DESELECTED_KEY,
  EXPENSE_TYPE_DESELECTED_KEY,
  EXPENSE_CATEGORY_DESELECTED_KEY,
  INCOMING_TYPE_DESELECTED_KEY,
] as const;