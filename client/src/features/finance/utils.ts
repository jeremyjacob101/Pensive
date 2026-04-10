import { fallbackReferenceData } from "./fallbacks";
import type { AuthUser } from "./types";

export const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
});

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function shiftMonth(monthKey: string, offset: number) {
  const date = parseMonthKey(monthKey);
  date.setMonth(date.getMonth() + offset);
  return getMonthKey(date);
}

export function formatMonthLabel(monthKey: string) {
  return parseMonthKey(monthKey).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDaysUntil(daysUntil: number) {
  if (daysUntil === 0) {
    return "Today";
  }

  if (daysUntil === 1) {
    return "Tomorrow";
  }

  if (daysUntil === -1) {
    return "Yesterday";
  }

  if (daysUntil > 1) {
    return `In ${daysUntil} days`;
  }

  return `${Math.abs(daysUntil)} days ago`;
}

export function pluralize(word: string, count: number) {
  if (count === 1) {
    return `${count} ${word}`;
  }

  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return `${count} ${word.slice(0, -1)}ies`;
  }

  return `${count} ${word}s`;
}

export function formatDisplayValue(value: string | null, fallback: string) {
  return value?.trim() ? value : fallback;
}

export function getUserInitials(user: AuthUser | null) {
  if (!user?.profile.fullName) {
    return "U";
  }

  return user.profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getFallbackSubcategories(type: "expense" | "income", category: string) {
  return fallbackReferenceData.subcategories[type][category] ?? [];
}
