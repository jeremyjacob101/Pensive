import type { Entry, EntryType } from "../types";

const ENTRY_CODE_PATTERN = /^(EXP|INC)(\d+)(?:-(\d+))?$/i;
const SERIAL_PAD_LENGTH = 12;
const SUFFIX_PAD_LENGTH = 3;

export type ParsedEntryCode = {
  prefix: "EXP" | "INC";
  serial: number;
  suffix: number;
  canonical: string;
};

function getPrefix(type: EntryType) {
  return type === "income" ? "INC" : "EXP";
}

function padSerial(serial: number) {
  return String(serial).padStart(SERIAL_PAD_LENGTH, "0");
}

function padSuffix(suffix: number) {
  return String(suffix).padStart(SUFFIX_PAD_LENGTH, "0");
}

export function formatEntryCode(
  prefix: "EXP" | "INC",
  serial: number,
  suffix = 0,
) {
  return `${prefix}${padSerial(Math.max(1, serial))}-${padSuffix(Math.max(0, suffix))}`;
}

export function parseEntryCode(value: unknown): ParsedEntryCode | null {
  const cleaned = String(value ?? "").trim();
  const match = cleaned.match(ENTRY_CODE_PATTERN);

  if (!match) {
    return null;
  }

  const prefix = match[1].toUpperCase() as "EXP" | "INC";
  const serial = Number.parseInt(match[2], 10);
  const suffix = Number.parseInt(match[3] ?? "0", 10);

  if (
    !Number.isInteger(serial) ||
    serial <= 0 ||
    !Number.isInteger(suffix) ||
    suffix < 0
  ) {
    return null;
  }

  return {
    prefix,
    serial,
    suffix,
    canonical: formatEntryCode(prefix, serial, suffix),
  };
}

export function normalizeEntryCode(
  value: unknown,
  type: EntryType,
  fallbackSerial: number,
  fallbackSuffix = 0,
) {
  const parsed = parseEntryCode(value);

  if (parsed && parsed.prefix === getPrefix(type)) {
    return parsed.canonical;
  }

  return formatEntryCode(getPrefix(type), fallbackSerial, fallbackSuffix);
}

export function getNextEntryCode(existingEntries: Entry[], type: EntryType) {
  const prefix = getPrefix(type);
  const maxSerial = existingEntries.reduce((currentMax, entry) => {
    const parsed = parseEntryCode(entry.entryCode);

    if (!parsed || parsed.prefix !== prefix) {
      return currentMax;
    }

    return Math.max(currentMax, parsed.serial);
  }, 0);

  return formatEntryCode(prefix, maxSerial + 1, 0);
}

export function getNextSplitEntryCode(
  existingEntries: Entry[],
  type: EntryType,
  anchorEntryCode: string,
) {
  const anchor = parseEntryCode(anchorEntryCode);
  const prefix = getPrefix(type);

  if (!anchor || anchor.prefix !== prefix) {
    return getNextEntryCode(existingEntries, type);
  }

  const maxSuffix = existingEntries.reduce((currentMax, entry) => {
    const parsed = parseEntryCode(entry.entryCode);

    if (
      !parsed ||
      parsed.prefix !== prefix ||
      parsed.serial !== anchor.serial
    ) {
      return currentMax;
    }

    return Math.max(currentMax, parsed.suffix);
  }, anchor.suffix);

  return formatEntryCode(prefix, anchor.serial, maxSuffix + 1);
}
