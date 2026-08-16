import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const beforeCommit = process.env.GITHUB_BASE_SHA;
const stagingDeployKey = process.env.CONVEX_DEPLOY_KEY;
const snapshotPath = process.env.SNAPSHOT_PATH;
const runId = process.env.GITHUB_RUN_ID ?? `${Date.now()}`;

if (!beforeCommit || !stagingDeployKey || !snapshotPath) {
  throw new Error(
    "GITHUB_BASE_SHA, CONVEX_DEPLOY_KEY, and SNAPSHOT_PATH are required",
  );
}

const workspace = process.cwd();
const temporaryRoot = join(tmpdir(), `pensive-staging-compatibility-${runId}`);
mkdirSync(temporaryRoot, { recursive: true });
const stagingUrlPath = join(temporaryRoot, "staging-url.txt");
const credentialsPath = join(temporaryRoot, "compatibility-credentials.json");
const previousArchivePath = join(temporaryRoot, "previous-main.tar");
const previousDirectory = join(temporaryRoot, "previous-main");

function commandEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    CI: "true",
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspace,
    env: commandEnv(options.env),
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args[0] ?? ""} failed`);
  }

  return options.capture ? result.stdout.trim() : "";
}

function runConvex(args, options = {}) {
  return run("npx", ["convex", ...args], {
    ...options,
    env: {
      CONVEX_DEPLOY_KEY: stagingDeployKey,
      ...options.env,
    },
  });
}

function deployCurrentCode() {
  runConvex(
    [
      "deploy",
      "--message",
      `Compatibility test for ${process.env.GITHUB_HEAD_SHA ?? "pull request"}`,
      "--cmd",
      "node scripts/write-deployment-url.mjs",
      "--cmd-url-env-var-name",
      "COMPAT_CONVEX_URL",
    ],
    {
      env: { DEPLOYMENT_URL_OUTPUT: stagingUrlPath },
    },
  );

  if (!existsSync(stagingUrlPath)) {
    throw new Error("Staging deployment URL was not written");
  }
}

function importSnapshot() {
  runConvex([
    "import",
    snapshotPath,
    "--deployment",
    "staging",
    "--replace-all",
    "--yes",
  ]);
}

function exportAndReimportPostChangeState() {
  const postChangePath = join(temporaryRoot, "post-change-state.zip");
  runConvex(["export", "--deployment", "staging", "--path", postChangePath]);
  runConvex([
    "import",
    postChangePath,
    "--deployment",
    "staging",
    "--replace-all",
    "--yes",
  ]);
}

function preparePreviousRevision() {
  run("git", ["archive", beforeCommit, "-o", previousArchivePath]);
  mkdirSync(previousDirectory, { recursive: true });
  run("tar", ["-xf", previousArchivePath, "-C", previousDirectory]);
  run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: previousDirectory,
  });
}

function runCompatibilitySuite(cwd, keepData) {
  run(
    "node",
    [
      "scripts/convex-compatibility.mjs",
      "--url-file",
      stagingUrlPath,
      "--credentials-file",
      credentialsPath,
    ],
    {
      cwd,
      env: { COMPAT_KEEP_DATA: keepData ? "true" : "false" },
    },
  );
}

async function main() {
  console.log("Deploying the proposed code to the existing staging deployment");
  deployCurrentCode();

  console.log("Importing the production snapshot into staging");
  importSnapshot();

  console.log("Running forward compatibility contracts and full data checks");
  runCompatibilitySuite(workspace, true);
  exportAndReimportPostChangeState();

  console.log("Running the previous client contracts against the new data");
  preparePreviousRevision();
  runCompatibilitySuite(previousDirectory, false);

  console.log("Production schema gate passed");
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Staging compatibility checks failed",
  );
  process.exitCode = 1;
});