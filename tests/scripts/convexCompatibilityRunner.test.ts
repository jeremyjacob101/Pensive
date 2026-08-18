import { describe, expect, it } from "vitest";

type RunnerModule = {
  adaptLegacyCompatibilityScript: (source: string) => {
    adapted: boolean;
    source: string;
  };
};

const runnerModuleUrl = new URL(
  "../../scripts/convex-compatibility-runner.mjs",
  import.meta.url,
);
const { adaptLegacyCompatibilityScript } = (await import(
  runnerModuleUrl.href
)) as RunnerModule;

function legacyRunnerSource() {
  return [
    'const urlFileIndex = process.argv.indexOf("--url-file");',
    'const credentialsFileIndex = process.argv.indexOf("--credentials-file");',
    'const keepData = process.env.COMPAT_KEEP_DATA === "true";',
    "async function request(path) {",
    "  return await fetch(`${baseUrl}${path}`, {});",
    "}",
    "async function signIn() {",
    '  return await request("/api/auth/sign-in", {});',
    "}",
    "const client = new ConvexHttpClient(baseUrl);",
  ].join("\n");
}

describe("legacy Convex compatibility runner adapter", () => {
  it("moves only legacy HTTP contracts to the site URL", () => {
    const result = adaptLegacyCompatibilityScript(legacyRunnerSource());

    expect(result.adapted).toBe(true);
    expect(result.source).toContain(
      "fetch(`${process.env.COMPAT_CONVEX_SITE_URL}${path}`",
    );
    expect(result.source).not.toContain("fetch(`${baseUrl}${path}`");
    expect(result.source).toContain("new ConvexHttpClient(baseUrl)");
  });

  it("leaves runners that already support a site URL untouched", () => {
    const source = [
      'const siteUrlFileIndex = process.argv.indexOf("--site-url-file");',
      "const response = await fetch(`${siteUrl}${path}`);",
      "const client = new ConvexHttpClient(cloudUrl);",
    ].join("\n");

    expect(adaptLegacyCompatibilityScript(source)).toEqual({
      adapted: false,
      source,
    });
  });

  it("fails closed when the legacy runner shape is not recognized", () => {
    const source = legacyRunnerSource().replace(
      "new ConvexHttpClient(baseUrl)",
      "new ConvexHttpClient(unknownUrl)",
    );

    expect(() => adaptLegacyCompatibilityScript(source)).toThrow(
      /Cannot safely adapt.*Legacy Convex client matches: 0/s,
    );
  });

  it("fails closed instead of partially adapting multiple HTTP transports", () => {
    const source = legacyRunnerSource().replace(
      "async function signIn()",
      "const duplicate = fetch(`${baseUrl}${path}`);\nasync function signIn()",
    );

    expect(() => adaptLegacyCompatibilityScript(source)).toThrow(
      /Legacy HTTP request matches: 2/,
    );
  });
});