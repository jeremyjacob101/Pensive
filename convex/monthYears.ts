const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizeDate(value: string) {
  const input = value.trim();
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return input;

  const usMatch = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const mm = usMatch[1].padStart(2, "0");
    const dd = usMatch[2].padStart(2, "0");
    const yyyy = usMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return input;
}

export function monthFromDate(dateValue: string) {
  const normalizedDate = normalizeDate(dateValue);
  const match = normalizedDate.match(/^(\d{4})-(\d{2})-/);
  if (!match) return "";
  return `${match[1]}-${match[2]}`;
}

export function normalizeMonthYearsInput(
  input: string[] | undefined,
  fallbackDate: string,
) {
  const unique = new Set<string>();

  for (const value of input ?? []) {
    const trimmed = value.trim();
    if (MONTH_PATTERN.test(trimmed)) unique.add(trimmed);
  }

  if (unique.size === 0) {
    const fallback = monthFromDate(fallbackDate);
    if (MONTH_PATTERN.test(fallback)) unique.add(fallback);
  }

  const monthYears = [...unique].sort((a, b) => a.localeCompare(b));
  if (monthYears.length === 0) {
    throw new Error("At least one valid month is required");
  }

  return monthYears;
}
