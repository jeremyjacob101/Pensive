export function formatDisplayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatShortDisplayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function formatMonthYearLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function formatMonthYearShortLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function shiftMonth(month: string, delta: number): string {
  const match = month.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = parseInt(match[1], 10);
  const monthNum = parseInt(match[2], 10) - 1;
  const totalMonths = year * 12 + monthNum + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12;
  return `${newYear}-${String(newMonth + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(parsed);
}

export function formatYearLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
  }).format(parsed);
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthFromIsoDate(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return "";
  return `${match[1]}-${match[2]}`;
}

export function formatMonthValue(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  return formatMonthYearLabel(`${match[1]}-${match[2]}-01`) || value;
}

export function normalizeMonthYears(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((
    a,
    b,
  ) => a.localeCompare(b));
}

export function parseMonthYears(raw: string | null | undefined, date: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "[]");
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  const cleaned = [...new Set(parsed.map((value) => String(value).trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  if (cleaned.length > 0) return cleaned;
  const fallback = getMonthFromIsoDate(date);
  return fallback ? [fallback] : [];
}

export function formatOrdinalDay(dayOfMonth: number): string {
  const remainder100 = dayOfMonth % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${dayOfMonth}th`;
  const remainder10 = dayOfMonth % 10;
  if (remainder10 === 1) return `${dayOfMonth}st`;
  if (remainder10 === 2) return `${dayOfMonth}nd`;
  if (remainder10 === 3) return `${dayOfMonth}rd`;
  return `${dayOfMonth}th`;
}

export function formatShortYear(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const fullYear = parsed.getFullYear();
  return `'${String(fullYear).slice(2)}`;
}

export function isStartOfMonth(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getDate() === 1;
}

export function isEndOfMonth(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const nextDay = new Date(parsed);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.getMonth() !== parsed.getMonth();
}

export function formatRangeLabel(
  start: string,
  end: string,
  isDefaultMonth: boolean,
): string {
  if (!start || !end) return "";

  if (isDefaultMonth) {
    const startMonth = new Intl.DateTimeFormat("en-US", {
      month: "long",
    }).format(new Date(`${start}T00:00:00`));
    const startYear = formatShortYear(start);
    return `${startMonth} ${startYear}`;
  }

  const startMonthLong = new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(new Date(`${start}T00:00:00`));
  const startMonthShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(new Date(`${start}T00:00:00`));
  const startYear = formatShortYear(start);
  const startDay = new Date(`${start}T00:00:00`).getDate();

  const endMonthLong = new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(new Date(`${end}T00:00:00`));
  const endMonthShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(new Date(`${end}T00:00:00`));
  const endYear = formatShortYear(end);
  const endDay = new Date(`${end}T00:00:00`).getDate();

  const startIsFull = isStartOfMonth(start) && isEndOfMonth(start);
  const endIsFull = isStartOfMonth(end) && isEndOfMonth(end);
  const startMonthOnly = startIsFull
    ? `${startMonthLong} ${startYear}`
    : `${startMonthShort} ${startDay} ${startYear}`;
  const endMonthOnly = endIsFull
    ? `${endMonthLong} ${endYear}`
    : `${endMonthShort} ${endDay} ${endYear}`;

  return `${startMonthOnly} – ${endMonthOnly}`;
}

export function getMonthsInRange(start: string, end: string): string[] {
  const startParsed = new Date(`${start}T00:00:00`);
  const endParsed = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startParsed.getTime()) || Number.isNaN(endParsed.getTime()))
    return [];

  const months: string[] = [];
  const current = new Date(
    startParsed.getFullYear(),
    startParsed.getMonth(),
    1,
  );
  const endMonth = new Date(endParsed.getFullYear(), endParsed.getMonth(), 1);

  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

export function getMonthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let current = start;
  while (current <= end) {
    months.push(current);
    current = shiftMonth(current, 1);
  }
  return months;
}

export function getMonthStartEnd(dateStr: string): {
  start: string;
  end: string;
} {
  if (!dateStr) return { start: "", end: "" };
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { start: "", end: "" };
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function getMonthStartEndFromMonth(month: string): {
  start: string;
  end: string;
} {
  const match = month.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return { start: "", end: "" };
  return getMonthStartEnd(`${match[1]}-${match[2]}-01`);
}
