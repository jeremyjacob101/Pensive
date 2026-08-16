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
  const run = process.env.GITHUB_RUN_ID ?? "local";
  const suffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return `${prefix}-${run}-${suffix}`.slice(0, 32).toLowerCase();
}
