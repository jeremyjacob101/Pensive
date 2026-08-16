import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../", import.meta.url);

async function workflow(name: string) {
  return await readFile(new URL(`.github/workflows/${name}`, repoRoot), "utf8");
}

describe("CI test safety", () => {
  it("runs the required test layers for pull requests and staging pushes", async () => {
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

  it("keeps staging verification ahead of deployment", async () => {
    const contents = await workflow("deploy-convex-environments.yml");
    expect(contents).toContain("run: npm run test:static");
    expect(contents).toContain("run: npm test");
    expect(contents).toContain("needs: verify");
  });
});