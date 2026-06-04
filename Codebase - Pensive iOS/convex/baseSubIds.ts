const SUB_ID_WIDTH = 3;

export type BaseSubIds = {
  legacyId: string;
  baseId: string;
  subId: string;
};

function normalizeSubId(rawSubId: string | null | undefined) {
  const parsed = Number.parseInt(rawSubId ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return "000";
  return String(parsed).padStart(SUB_ID_WIDTH, "0");
}

function splitLegacyId(rawId: string) {
  const trimmed = rawId.trim();
  const match = trimmed.match(/^(.+)-(\d+)$/);
  if (!match) return null;

  const baseId = match[1].trim();
  if (!baseId) return null;

  return { baseId, subId: normalizeSubId(match[2]) };
}

export function normalizeLegacyBaseSubId(
  rawId: string | null | undefined,
  fallbackBaseId: string,
): BaseSubIds {
  const trimmed = String(rawId ?? "").trim();
  const parsed = splitLegacyId(trimmed);
  if (parsed) {
    return {
      legacyId: `${parsed.baseId}-${parsed.subId}`,
      baseId: parsed.baseId,
      subId: parsed.subId,
    };
  }

  const baseId = trimmed || fallbackBaseId;
  return {
    legacyId: `${baseId}-000`,
    baseId,
    subId: "000",
  };
}
