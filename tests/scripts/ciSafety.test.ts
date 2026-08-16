import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../", import.meta.url);

async function workflow(name: string) {
  return await readFile(new URL(`.github/workflows/${name}`, repoRoot), "utf8");
}

describe("CI test safety", () => {
  it("runs the required test layers for pull requests and protected branch pushes", async () => {
    const contents = await workflow("test-suite.yml");
    expect(contents).toContain("pull_request:");
    expect(contents).toContain("- main");
    expect(contents).toContain("- staging");
    expect(contents).toContain("behavior-tests:");
    expect(contents).toContain("npm test");
    expect(contents).toContain("browser-e2e:");
    expect(contents).toContain("npm run test:e2e");
    expect(contents).toContain("ios-tests:");
    expect(contents).toContain("./scripts/test-ios-stable.sh");
    expect(contents).toContain("- hotfix");
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

  it("deploys staging only after every Test Suite job passes", async () => {
    const contents = await workflow("test-suite.yml");
    expect(contents).toContain("deploy-staging:");
    expect(contents).toContain(
      "Deploy Convex staging after the complete test suite",
    );
    expect(contents).toMatch(
      /needs:\s*[\r\n]+\s+- static-quality[\r\n]+\s+- behavior-tests[\r\n]+\s+- browser-e2e[\r\n]+\s+- ios-tests/,
    );
    expect(contents).toContain("github.ref == 'refs/heads/staging'");
  });

  it("does not start a second staging deployment from the sync workflow", async () => {
    const contents = await workflow("sync-main-to-staging.yml");
    expect(contents).not.toContain(
      "gh workflow run deploy-convex-environments.yml",
    );
  });

  it("requires the exact full Test Suite before hotfix promotion can update main", async () => {
    const contents = await workflow("promote-hotfix-to-main.yml");
    expect(contents).toContain("checks: read");
    expect(contents).toContain(
      "Require the complete Test Suite for the exact hotfix commit",
    );
    for (const check of [
      "Static quality",
      "Web and Convex behavior tests",
      "Browser E2E (non-production)",
      "iOS unit, integration, and UI tests",
    ]) {
      expect(contents).toContain(check);
    }
    expect(contents).toContain("max_wait_seconds=1800");
    expect(contents).toContain("exit 1");
  });
});