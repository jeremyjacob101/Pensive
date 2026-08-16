import { randomBytes } from "node:crypto";

const productionHosts = new Set([
  "frugal-mosquito-712.convex.cloud",
  "frugal-mosquito-712.convex.site",
]);

export function assertNonProductionUrl(value: string, label = "test URL") {
  const parsed = new URL(value);
  if (productionHosts.has(parsed.hostname)) {
    throw new Error(`${label} resolves to production: ${parsed.hostname}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  return parsed;
}

export function assertNonProductionEnvironment(env: NodeJS.ProcessEnv) {
  for (const [key, value] of Object.entries(env)) {
    if (!value || !/(URL|DEPLOY|ENV|CONFIG)/i.test(key)) continue;
    if (/frugal-mosquito-712|--prod|production/i.test(value)) {
      throw new Error(
        `Production value detected in test environment variable ${key}`,
      );
    }
  }
}

export function uniqueTestUsername(prefix = "pensive-test") {
  const normalizedPrefix =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-") || "test";
  const run = (process.env.GITHUB_RUN_ID ?? "local")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  const runPart = run.slice(-5) || "local";
  const nonce = randomBytes(6).toString("hex");
  const prefixLength = Math.max(1, 32 - runPart.length - nonce.length - 2);
  const boundedPrefix =
    normalizedPrefix.slice(0, prefixLength).replace(/-+$/, "") || "test";
  return `${boundedPrefix}-${runPart}-${nonce}`.slice(0, 32);
}