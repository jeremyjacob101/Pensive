import {
  cleanOptionalString,
  createId,
  normalizeDateInput,
  normalizeType,
  parseAmount,
} from "../utils/common.js";

export const RECURRING_ACTIVE_STATUS = "add";
export const RECURRING_PAUSED_STATUS = "paused";

export function normalizeRecurringStatus(
  value,
  fallback = RECURRING_ACTIVE_STATUS,
) {
  const cleaned = cleanOptionalString(value);

  if (!cleaned) {
    return fallback;
  }

  return cleaned.toLowerCase() === RECURRING_ACTIVE_STATUS
    ? RECURRING_ACTIVE_STATUS
    : RECURRING_PAUSED_STATUS;
}

export function isRecurringRuleActive(ruleOrStatus) {
  const status =
    typeof ruleOrStatus === "string" ? ruleOrStatus : ruleOrStatus?.status;
  return normalizeRecurringStatus(status) === RECURRING_ACTIVE_STATUS;
}

export function parseRecurringIntervalMonths(frequency) {
  const normalized = String(frequency ?? "")
    .trim()
    .toLowerCase();
  const match = normalized.match(/(\d+)/);

  if (normalized.includes("month")) {
    return Math.max(1, Number(match?.[1] ?? 1));
  }

  return 1;
}

export function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function buildOccurrenceDate(year, monthIndex, dayOfMonth) {
  const safeDay = Math.min(dayOfMonth, getDaysInMonth(year, monthIndex));
  return new Date(year, monthIndex, safeDay);
}

export function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildOccurrenceKey(ruleId, dueDate) {
  return `${ruleId}:${dueDate}`;
}

export function buildRecurringRuleFromBody(body, options = {}) {
  const { existingRule, now = new Date().toISOString() } = options;
  const name = cleanOptionalString(body.name ?? existingRule?.name);
  const amount = parseAmount(body.amount ?? existingRule?.amount);
  const dayOfMonth = Number(body.dayOfMonth ?? existingRule?.dayOfMonth);
  const type = normalizeType(body.type, existingRule?.type ?? "expense");
  const fallbackDate = existingRule?.startDate ?? now.slice(0, 10);
  const startDate = normalizeDateInput(body.startDate, fallbackDate);

  if (!name || amount === null || !Number.isFinite(dayOfMonth) || !startDate) {
    return { error: "name, amount, and day of month are required" };
  }

  const createdAt = existingRule?.createdAt ?? now;

  return {
    rule: {
      id: existingRule?.id ?? createId(),
      type,
      status: normalizeRecurringStatus(body.status, existingRule?.status),
      name,
      amount,
      frequency:
        cleanOptionalString(body.frequency ?? existingRule?.frequency) ??
        "Monthly",
      dayOfMonth: Math.max(1, Math.min(31, Math.round(dayOfMonth))),
      account: cleanOptionalString(body.account ?? existingRule?.account),
      category: cleanOptionalString(body.category ?? existingRule?.category),
      entryKind:
        type === "income"
          ? null
          : (cleanOptionalString(body.entryKind ?? existingRule?.entryKind) ??
            "Regular"),
      counterparty: cleanOptionalString(
        body.counterparty ?? existingRule?.counterparty,
      ),
      notes: cleanOptionalString(body.notes ?? existingRule?.notes),
      startDate,
      createdAt,
      updatedAt: now,
    },
  };
}
