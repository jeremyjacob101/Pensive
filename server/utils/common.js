export function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function cleanOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}

export function cleanRequiredString(value) {
  return cleanOptionalString(value);
}

export function normalizeType(value, fallback = "expense") {
  return value === "income" ? "income" : fallback;
}

export function parseAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Number(amount.toFixed(2));
}

export function parseNumberish(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

export function normalizeDateInput(
  value,
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
  value,
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

export function inferLegacyTimestamp(entry) {
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

export function getValueFromBody(body, primaryKey, fallbackValue, aliases = []) {
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

export function slugifyIdPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeUsernameKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function validateUsername(value) {
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

export function validatePassword(value) {
  const password = String(value ?? "");

  if (!password) {
    return { error: "password is required" };
  }

  if (password.length < 4) {
    return { error: "password must be at least 4 characters" };
  }

  return { password };
}

export function normalizeEmail(value) {
  const email = cleanOptionalString(value);

  if (!email) {
    return null;
  }

  return email.toLowerCase();
}

export function normalizeAge(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const age = Number(value);

  if (!Number.isInteger(age) || age < 0 || age > 130) {
    return null;
  }

  return age;
}

export function uniqueSortedStrings(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function createId() {
  return crypto.randomUUID();
}

export function getMonthLabelFromDate(dateValue) {
  const date =
    typeof dateValue === "string"
      ? new Date(`${dateValue}T00:00:00`)
      : dateValue;

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function normalizeMonthLabelToken(value) {
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

export function normalizeAllocationMonths(value, fallbackDate) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = rawValues
    .map((item) => normalizeMonthLabelToken(item))
    .filter(Boolean);

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

export function getUsernameFromEmail(email) {
  if (!email) {
    return "user";
  }

  const localPart = email.split("@")[0] ?? "user";

  return (
    localPart
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user"
  );
}
