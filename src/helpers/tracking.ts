export function formatMonthShort(value: string) {
  const parsed = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    parsed,
  );
  const year = String(parsed.getFullYear()).slice(2);
  return `${month} '${year}`;
}

export function shiftMonth(month: string, delta: number): string {
  const match = month.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = Number.parseInt(match[1], 10);
  const monthNum = Number.parseInt(match[2], 10) - 1;
  const totalMonths = year * 12 + monthNum + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = ((totalMonths % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
}

export function getMonthsBetween(start: string, end: string) {
  if (!start || !end || start > end) return [];
  const months: string[] = [];
  let current = start;
  while (current <= end) {
    months.push(current);
    current = shiftMonth(current, 1);
  }
  return months;
}

export const TRACKING_VISIBLE_SEGMENTS = 10;
export const MAX_BUFFER_MONTHS = 12;

export function parseStartByRow(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const entries = Object.entries(parsed);
    const out: Record<string, string> = {};
    for (const [key, rowStart] of entries) {
      if (typeof rowStart !== "string") continue;
      if (!/^\d{4}-\d{2}$/.test(rowStart.trim())) continue;
      out[key] = rowStart.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function parseBufferByRow(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const entries = Object.entries(parsed);
    const out: Record<string, number> = {};
    for (const [key, rowBuffer] of entries) {
      const numeric =
        typeof rowBuffer === "number"
          ? rowBuffer
          : Number.parseInt(String(rowBuffer), 10);
      if (!Number.isFinite(numeric)) continue;
      out[key] = Math.max(0, Math.min(MAX_BUFFER_MONTHS, Math.trunc(numeric)));
    }
    return out;
  } catch {
    return {};
  }
}

export function monthInTrailingBuffer(
  month: string,
  currentMonth: string,
  bufferMonths: number,
) {
  if (bufferMonths <= 0) return false;
  const bufferStart = shiftMonth(currentMonth, -(bufferMonths - 1));
  return month >= bufferStart && month <= currentMonth;
}

export function snapToNewestMonth(node: HTMLDivElement | null) {
  if (!node) return;
  const target = Math.max(0, node.scrollWidth - node.clientWidth);
  node.scrollLeft = target;
  requestAnimationFrame(() => {
    node.scrollLeft = target;
  });
}
