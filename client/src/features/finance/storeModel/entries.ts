import type { Entry, EntryType, Profile } from "../types";
import {
  PARTIAL_REIMBURSEMENT_TYPES,
  PARTIAL_SHARED_PAYMENT_TYPES,
} from "./constants";
import {
  cleanOptionalString,
  cleanRequiredString,
  createId,
  getMonthLabelFromDate,
  getValueFromBody,
  normalizeAge,
  normalizeAllocationMonths,
  normalizeDateInput,
  normalizeEmail,
  normalizeType,
  parseAmount,
} from "./core";
import { getNextEntryCode, getNextSplitEntryCode, parseEntryCode } from "./entryCodes";

function sortEntries(entries: Entry[]) {
  return [...entries].sort((left, right) => {
    const leftValue = `${left.date}-${left.updatedAt}`;
    const rightValue = `${right.date}-${right.updatedAt}`;
    return rightValue.localeCompare(leftValue);
  });
}

export function filterEntries(
  userStore: { entries: Entry[] },
  filters: { type?: EntryType; month?: string } = {},
) {
  const { type, month } = filters;

  return sortEntries(
    userStore.entries.filter((entry) => {
      const matchesType = !type || entry.type === type;
      const matchesMonth = !month || entry.date.startsWith(`${month}-`);
      return matchesType && matchesMonth;
    }),
  );
}

function getMostRecentEntryCode(existingEntries: Entry[], type: EntryType) {
  return sortEntries(existingEntries.filter((entry) => entry.type === type))[0]?.entryCode ?? null;
}

function applyExpenseShortcut(
  body: Record<string, unknown>,
  type: EntryType,
) {
  const rawName = String(body.name ?? "").trim();

  if (type !== "expense" || !rawName) {
    return {
      name: rawName,
      amount: parseAmount(body.amount),
      category: cleanOptionalString(body.category),
      counterparty: cleanOptionalString(body.counterparty ?? body.paidTo),
      account: cleanOptionalString(body.account),
    };
  }

  return {
    name: rawName,
    amount: parseAmount(body.amount),
    category: cleanOptionalString(body.category),
    counterparty: cleanOptionalString(body.counterparty ?? body.paidTo),
    account: cleanOptionalString(body.account),
  };
}

export function buildEntryFromBody(
  body: Record<string, unknown>,
  options: {
    forcedType?: EntryType;
    existingEntry?: Entry;
    existingEntries?: Entry[];
    now?: string;
  } = {},
) {
  const { forcedType, existingEntry, existingEntries = [], now } = options;
  const timestamp = now ?? new Date().toISOString();
  const fallbackDate = existingEntry?.date ?? timestamp.slice(0, 10);
  const fallbackCreatedAt = existingEntry?.createdAt ?? timestamp;
  const type = forcedType ?? normalizeType(body.type, existingEntry?.type ?? "expense");
  const shortcutResult = applyExpenseShortcut(body, type);
  const rawNameValue = getValueFromBody(body, "name", existingEntry?.name);
  const startingName = shortcutResult.name || cleanOptionalString(rawNameValue) || "";
  const sameGroup = !existingEntry && startingName.startsWith("SAME ");
  const name = cleanOptionalString(sameGroup ? startingName.slice(5) : startingName);
  const amount = shortcutResult.amount ?? parseAmount(getValueFromBody(body, "amount", existingEntry?.amount));
  const date = normalizeDateInput(getValueFromBody(body, "date", existingEntry?.date), fallbackDate);
  const categoryValue =
    shortcutResult.category ??
    cleanOptionalString(getValueFromBody(body, "category", existingEntry?.category));
  const subcategoryValue = cleanOptionalString(
    getValueFromBody(body, "subcategory", existingEntry?.subcategory, ["subCategory"]),
  );
  const accountValue =
    shortcutResult.account ??
    cleanOptionalString(getValueFromBody(body, "account", existingEntry?.account));
  const notesValue = cleanOptionalString(getValueFromBody(body, "notes", existingEntry?.notes));
  const entryKindValue = cleanOptionalString(
    getValueFromBody(body, "entryKind", existingEntry?.entryKind, ["kind"]),
  );
  const counterpartyValue =
    shortcutResult.counterparty ??
    cleanOptionalString(
      getValueFromBody(body, "counterparty", existingEntry?.counterparty, ["paidTo", "paidBy"]),
    );
  let commentsValue = cleanOptionalString(
    getValueFromBody(body, "comments", existingEntry?.comments),
  );

  if (!name) {
    return { error: "name is required" };
  }

  if (amount === null) {
    return { error: "amount must be a number greater than 0" };
  }

  if (!date) {
    return { error: "date must be a valid date" };
  }

  const entryKind =
    type === "expense"
      ? entryKindValue ?? existingEntry?.entryKind ?? "Regular"
      : entryKindValue ?? null;

  if (
    type === "expense" &&
    entryKind &&
    (PARTIAL_REIMBURSEMENT_TYPES.has(entryKind.toLowerCase()) ||
      PARTIAL_SHARED_PAYMENT_TYPES.has(entryKind.toLowerCase())) &&
    !commentsValue
  ) {
    commentsValue = "[] payed [amount] | [] pays them back [amount]";
  }

  const allocationMonths =
    type === "income"
      ? normalizeAllocationMonths(
          getValueFromBody(body, "allocationMonths", existingEntry?.allocationMonths, [
            "monthYear",
            "monthLabel",
            "allocationMonthsText",
          ]),
          date,
        )
      : [getMonthLabelFromDate(date)];

  const entryCode =
    existingEntry?.entryCode ??
    (sameGroup
      ? (() => {
          const recentEntryCode = getMostRecentEntryCode(existingEntries, type);

          if (!recentEntryCode) {
            return getNextEntryCode(existingEntries, type);
          }

          const parsedRecentCode = parseEntryCode(recentEntryCode);
          return parsedRecentCode
            ? getNextSplitEntryCode(existingEntries, type, parsedRecentCode.canonical)
            : getNextEntryCode(existingEntries, type);
        })()
      : getNextEntryCode(existingEntries, type));

  return {
    entry: {
      id: existingEntry?.id ?? createId(),
      type,
      name,
      amount,
      category: categoryValue,
      subcategory: subcategoryValue,
      date,
      account: accountValue,
      notes: notesValue,
      entryKind,
      counterparty: counterpartyValue,
      comments: commentsValue,
      entryCode,
      allocationMonths,
      linkedRecurringRuleId: cleanOptionalString(
        getValueFromBody(body, "linkedRecurringRuleId", existingEntry?.linkedRecurringRuleId),
      ),
      recurringOccurrenceKey: cleanOptionalString(
        getValueFromBody(body, "recurringOccurrenceKey", existingEntry?.recurringOccurrenceKey),
      ),
      createdAt: fallbackCreatedAt,
      updatedAt: timestamp,
    } satisfies Entry,
  };
}

export function validateMonth(month: string) {
  return /^\d{4}-\d{2}$/.test(month);
}

export function buildProfileFromBody(
  body: Record<string, unknown>,
  existingProfile: Profile,
) {
  const fullName = cleanRequiredString(getValueFromBody(body, "fullName", existingProfile.fullName));
  const email = normalizeEmail(getValueFromBody(body, "email", existingProfile.email));
  const pictureUrl = cleanOptionalString(
    getValueFromBody(body, "pictureUrl", existingProfile.pictureUrl, ["picture"]),
  );

  if (!fullName) {
    return { error: "full name is required" };
  }

  const ageInput = getValueFromBody(body, "age", existingProfile.age);
  const age = normalizeAge(ageInput);

  if (ageInput !== undefined && ageInput !== null && ageInput !== "" && age === null) {
    return { error: "age must be a whole number between 0 and 130" };
  }

  return {
    profile: {
      ...existingProfile,
      fullName,
      email,
      age,
      pictureUrl,
      updatedAt: new Date().toISOString(),
    } satisfies Profile,
  };
}

export { sortEntries };
