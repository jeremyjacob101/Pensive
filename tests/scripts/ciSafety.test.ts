import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../", import.meta.url);

async function workflow(name: string) {
  return await readFile(new URL(`.github/workflows/${name}`, repoRoot), "utf8");
}

async function script(name: string) {
  return await readFile(new URL(`scripts/${name}`, repoRoot), "utf8");
}

describe("CI test safety", () => {
  it("runs the required test layers for pull requests and staging pushes", async () => {
    const contents = await workflow("test-suite.yml");
    expect(contents).toContain("pull_request:");
    expect(contents).toContain("- main");
    expect(contents).toContain("- staging");
    expect(contents).toContain("workflow_call:");
    expect(contents).toContain("classify_staging_update:");
    expect(contents).toContain("trusted_main_alignment");
    expect(contents).toContain("behavior-tests:");
    expect(contents).toContain("npm test");
    expect(contents).toContain("browser-e2e:");
    expect(contents).toContain("npm run test:e2e");
    expect(contents).toContain("ios-tests:");
    expect(contents).toContain("./scripts/test-ios-stable.sh");
    expect(contents).not.toContain("      - hotfix");
  });

  it("does not hard-code the production deployment into the test workflow", async () => {
    const contents = await workflow("test-suite.yml");
    expect(contents).not.toMatch(
      /PENSIVE_(?:E2E|IOS)[^:]*:\s*https?:\/\/[^\n]*frugal-mosquito-712/i,
    );
    expect(contents).not.toContain("environment: Production");
    expect(contents).toContain("PENSIVE_E2E_API_URL");
    expect(contents).toContain("PENSIVE_E2E_CONVEX_URL");
    expect(contents).toContain("PENSIVE_IOS_TEST_HTTP_URL");
  });

  it("keeps the standalone staging verification workflow non-deploying", async () => {
    const contents = await workflow("deploy-convex-environments.yml");
    expect(contents).toContain("run: npm run test:static");
    expect(contents).toContain("run: npm test");
    expect(contents).not.toContain("Deploy Convex staging");
  });

  it("deploys staging after the suite or a trusted main alignment", async () => {
    const contents = await workflow("test-suite.yml");
    expect(contents).toContain("deploy-staging:");
    expect(contents).toContain(
      "Deploy Convex staging after tests or trusted main alignment",
    );
    expect(contents).toMatch(
      /needs:\s*[\r\n]+\s+- classify_staging_update[\r\n]+\s+- static-quality[\r\n]+\s+- behavior-tests[\r\n]+\s+- browser-e2e[\r\n]+\s+- ios-tests/,
    );
    expect(contents).toContain("github.ref == 'refs/heads/staging'");
    expect(contents).toContain("needs['static-quality'].result == 'success'");
  });

  it("does not start a second staging deployment from the sync workflow", async () => {
    const contents = await workflow("sync-main-to-staging.yml");
    expect(contents).toContain("environment: Staging");
    expect(contents).toContain("STAGING_SYNC_SSH_KEY");
    expect(contents).toContain("git@github.com:${GITHUB_REPOSITORY}.git");
    expect(contents).not.toContain(
      "gh workflow run deploy-convex-environments.yml",
    );
  });

  it("does not combine the staging deploy key with an explicit deployment flag", async () => {
    const contents = await script("convex-staging-compatibility.mjs");
    expect(contents).toContain("CONVEX_DEPLOY_KEY: stagingDeployKey");
    expect(contents).not.toContain('"--deployment"');
  });

  it("passes separate Convex cloud and site URLs to compatibility contracts", async () => {
    const stagingScript = await script("convex-staging-compatibility.mjs");
    const compatibilityScript = await script("convex-compatibility.mjs");
    const deploymentUrlScript = await script("write-deployment-url.mjs");

    expect(stagingScript).toContain("DEPLOYMENT_SITE_URL_OUTPUT");
    expect(stagingScript).toContain('"--site-url-file"');
    expect(deploymentUrlScript).toContain("VITE_CONVEX_SITE_URL");
    expect(compatibilityScript).toContain('"--site-url-file"');
    expect(compatibilityScript).toContain("fetch(`${siteUrl}${path}`");
    expect(compatibilityScript).toContain("new ConvexHttpClient(cloudUrl)");
    expect(compatibilityScript).toContain("responseSummary(result)");
  });

  it("keeps the automatic main-to-hotfix reset as a guarded ref sync", async () => {
    const contents = await workflow("sync-main-to-hotfix.yml");
    expect(contents).toContain("--force-with-lease");
    expect(contents).toContain('"${MAIN_SHA}:refs/heads/hotfix"');
  });

  it("runs the exact hotfix through the full Test Suite before promotion", async () => {
    const contents = await workflow("promote-hotfix-to-main.yml");
    expect(contents).toContain("Run full Test Suite on hotfix");
    expect(contents).toContain("uses: ./.github/workflows/test-suite.yml");
    expect(contents).toContain(
      "checkout_ref: ${{ needs.verify-hotfix.outputs.hotfix_sha }}",
    );
    expect(contents).toContain("secrets: inherit");
    expect(contents).toMatch(
      /needs:\s*[\r\n]+\s+- verify-hotfix[\r\n]+\s+- test-hotfix/,
    );
  });
});