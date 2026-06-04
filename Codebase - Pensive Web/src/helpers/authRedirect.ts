import type { RedirectLocation } from "../types/auth";

export function getRedirectTarget(state: unknown): string | null {
  const from = (state as { from?: RedirectLocation } | null)?.from;
  if (!from) return null;

  const pathname = typeof from.pathname === "string" ? from.pathname : "";
  if (!pathname.startsWith("/") || pathname === "/login") return null;

  const search = typeof from.search === "string" ? from.search : "";
  const hash = typeof from.hash === "string" ? from.hash : "";

  return `${pathname}${search}${hash}`;
}