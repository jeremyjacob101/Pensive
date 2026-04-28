import type { EntryType } from "../types";

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOwn<T extends object>(
  obj: T,
  key: PropertyKey,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function cleanOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}

export function cleanRequiredString(value: unknown) {
  return cleanOptionalString(value);
}

export function normalizeType(
  value: unknown,
  fallback: EntryType = "expense",
): EntryType {
  return value === "income" ? "income" : fallback;
}

export function parseAmount(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Number(amount.toFixed(2));
}

export function parseNumberish(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

export function normalizeDateInput(
  value: unknown,
  fallbackDate = new Date().toISOString().slice(0, 10),
) {
  if (value === undefined || value === null || value === "") {
    return fallbackDate;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 1000) {
    const excelDate = new Date(Date.UTC(1899, 11, 30));
    excelDate.setUTCDate(excelDate.getUTCDate() + Math.floor(numericValue));
    return excelDate.toISOString().slice(0, 10);
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeTimestamp(
  value: unknown,
  fallbackTimestamp = new Date().toISOString(),
) {
  if (!value) {
    return fallbackTimestamp;
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return fallbackTimestamp;
  }

  return parsed.toISOString();
}

export function inferLegacyTimestamp(
  entry: Record<string, unknown> | null | undefined,
) {
  const numericId = Number(entry?.id);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  const parsed = new Date(numericId);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function getValueFromBody(
  body: Record<string, unknown>,
  primaryKey: string,
  fallbackValue: unknown,
  aliases: string[] = [],
) {
  if (hasOwn(body, primaryKey)) {
    return body[primaryKey];
  }

  for (const alias of aliases) {
    if (hasOwn(body, alias)) {
      return body[alias];
    }
  }

  return fallbackValue;
}

export function slugifyIdPart(value: unknown) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeUsernameKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function validateUsername(value: unknown) {
  const username = normalizeUsernameKey(value);

  if (!username) {
    return { error: "username is required" };
  }

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return {
      error:
        "username must be 3-30 characters and only use letters, numbers, dots, underscores, or hyphens",
    };
  }

  return { username };
}

export function validatePassword(value: unknown) {
  const password = String(value ?? "");

  if (!password) {
    return { error: "password is required" };
  }

  if (password.length < 4) {
    return { error: "password must be at least 4 characters" };
  }

  return { password };
}

export function normalizeEmail(value: unknown) {
  const email = cleanOptionalString(value);

  if (!email) {
    return null;
  }

  return email.toLowerCase();
}

export function normalizeAge(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const age = Number(value);

  if (!Number.isInteger(age) || age < 0 || age > 130) {
    return null;
  }

  return age;
}

export function uniqueSortedStrings(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ].sort((left, right) => left.localeCompare(right));
}

export function createId() {
  return crypto.randomUUID();
}

export function getMonthLabelFromDate(dateValue: string | Date) {
  const date =
    typeof dateValue === "string"
      ? new Date(`${dateValue}T00:00:00`)
      : dateValue;
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function normalizeMonthLabelToken(value: unknown) {
  const cleaned = cleanOptionalString(value);

  if (!cleaned) {
    return null;
  }

  const asDate = normalizeDateInput(cleaned);

  if (asDate) {
    return getMonthLabelFromDate(asDate);
  }

  const parsed = new Date(`${cleaned} 1`);

  if (!Number.isNaN(parsed.getTime())) {
    return getMonthLabelFromDate(parsed);
  }

  return cleaned;
}

export function normalizeAllocationMonths(
  value: unknown,
  fallbackDate: string,
) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = rawValues
    .map((item) => normalizeMonthLabelToken(item))
    .filter((item): item is string => Boolean(item));

  if (normalized.length) {
    return uniqueSortedStrings(normalized);
  }

  return [getMonthLabelFromDate(fallbackDate)];
}

export function buildCurrentMonthStartDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}
