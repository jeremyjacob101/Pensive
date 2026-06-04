export function parseSubId(subId?: string) {
  const parsed = Number.parseInt((subId ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
