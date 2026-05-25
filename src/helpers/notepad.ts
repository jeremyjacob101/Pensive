import type { SizeMap } from "../types/notepad";

export function normalizeCells(cells: string[][] | undefined) {
  const source = Array.isArray(cells) ? cells : [];
  const rowCount = Math.max(1, source.length || 0);
  const colCount = Math.max(
    1,
    source.reduce((max, row) => {
      if (!Array.isArray(row)) return max;
      return Math.max(max, row.length);
    }, 0),
  );

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
    return Array.from({ length: colCount }, (_, colIndex) => {
      const value = row[colIndex];
      return typeof value === "string" ? value : "";
    });
  });
}

export function parseNumberArray(
  value: string,
  length: number,
  fallback: number,
  min: number,
) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Array.from({ length }, () => fallback);
    }
    return Array.from({ length }, (_, index) => {
      const raw = parsed[index];
      if (typeof raw !== "number" || Number.isNaN(raw)) return fallback;
      return Math.max(min, Math.round(raw));
    });
  } catch {
    return Array.from({ length }, () => fallback);
  }
}

export function parseSizeMap(raw: string): SizeMap {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const output: SizeMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        output[key] = value.filter((v) => typeof v === "number") as number[];
      }
    }
    return output;
  } catch {
    return {};
  }
}

export function columnLabel(index: number) {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}