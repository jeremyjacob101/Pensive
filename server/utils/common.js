function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function cleanOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}

function cleanRequiredString(value) {
  return cleanOptionalString(value);
}

function normalizeType(value, fallback = "expense") {
  return value === "income" ? "income" : fallback;
}

function parseAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Number(amount.toFixed(2));
}

function parseNumberish(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function normalizeDateInput(
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

function normalizeTimestamp(
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

function inferLegacyTimestamp(entry) {
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

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getValueFromBody(body, primaryKey, fallbackValue, aliases = []) {
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

function slugifyIdPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeUsernameKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function validateUsername(value) {
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

function validatePassword(value) {
  const password = String(value ?? "");

  if (!password) {
    return { error: "password is required" };
  }

  if (password.length < 4) {
    return { error: "password must be at least 4 characters" };
  }

  return { password };
}

function normalizeEmail(value) {
  const email = cleanOptionalString(value);

  if (!email) {
    return null;
  }

  return email.toLowerCase();
}

function normalizeAge(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const age = Number(value);

  if (!Number.isInteger(age) || age < 0 || age > 130) {
    return null;
  }

  return age;
}

function uniqueSortedStrings(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function createId() {
  return crypto.randomUUID();
}

function getMonthLabelFromDate(dateValue) {
  const date =
    typeof dateValue === "string"
      ? new Date(`${dateValue}T00:00:00`)
      : dateValue;

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function normalizeMonthLabelToken(value) {
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

function normalizeAllocationMonths(value, fallbackDate) {
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

function buildCurrentMonthStartDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function getUsernameFromEmail(email) {
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

module.exports = {
  buildCurrentMonthStartDate,
  cleanOptionalString,
  cleanRequiredString,
  createId,
  getCurrentMonth,
  getMonthLabelFromDate,
  getUsernameFromEmail,
  getValueFromBody,
  hasOwn,
  inferLegacyTimestamp,
  isPlainObject,
  normalizeAge,
  normalizeAllocationMonths,
  normalizeDateInput,
  normalizeEmail,
  normalizeMonthLabelToken,
  normalizeTimestamp,
  normalizeType,
  normalizeUsernameKey,
  parseAmount,
  parseNumberish,
  slugifyIdPart,
  uniqueSortedStrings,
  validatePassword,
  validateUsername,
};
