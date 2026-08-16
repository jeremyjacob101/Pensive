import { spawnSync } from "node:child_process";
import { createReadStream, mkdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const beforeCommit = process.env.GITHUB_BASE_SHA;
const afterCommit = process.env.GITHUB_HEAD_SHA;
const schemaHashValue = process.env.SCHEMA_HASH;
const productionDeployKey = process.env.CONVEX_DEPLOY_KEY;
const snapshotPath = process.env.SNAPSHOT_PATH;
const runId = process.env.GITHUB_RUN_ID ?? `${Date.now()}`;

if (
  !beforeCommit ||
  !afterCommit ||
  !schemaHashValue ||
  !productionDeployKey ||
  !snapshotPath
) {
  throw new Error(
    "GITHUB_BASE_SHA, GITHUB_HEAD_SHA, SCHEMA_HASH, CONVEX_DEPLOY_KEY, and SNAPSHOT_PATH are required",
  );
}

const workspace = process.cwd();
const temporaryRoot = join(tmpdir(), `pensive-schema-checkpoint-${runId}`);
mkdirSync(temporaryRoot, { recursive: true });

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
      CONVEX_DEPLOY_KEY: productionDeployKey,
      ...options.env,
    },
  });
}

function parseCliJson(output) {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Convex CLI may print informational lines before the JSON result.
    }
  }

  throw new Error("Convex CLI did not return JSON");
}

async function uploadSnapshot() {
  const uploadUrlOutput = runConvex(
    ["run", "backupSnapshots:generateUploadUrl", "--prod"],
    { capture: true },
  );
  const uploadUrl = parseCliJson(uploadUrlOutput);
  if (typeof uploadUrl !== "string" || !uploadUrl.startsWith("https://")) {
    throw new Error("Convex returned an invalid snapshot upload URL");
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: createReadStream(snapshotPath),
    duplex: "half",
  });
  if (!response.ok) {
    throw new Error(`Snapshot upload failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!body || typeof body.storageId !== "string") {
    throw new Error("Convex did not return a snapshot storage ID");
  }
  return body.storageId;
}

function recordSnapshot(storageId) {
  const archiveName = `prod-${afterCommit}-before-schema-change.zip`;
  const args = JSON.stringify({
    beforeCommit,
    afterCommit,
    schemaHash: schemaHashValue,
    archiveName,
    sizeBytes: statSync(snapshotPath).size,
    storageId,
  });

  runConvex(["run", "backupSnapshots:record", args, "--prod"], {
    capture: true,
  });
}

async function main() {
  console.log("Exporting the production database snapshot");
  runConvex(["export", "--prod", "--path", snapshotPath]);

  console.log("Storing the production snapshot in Convex File Storage");
  const storageId = await uploadSnapshot();
  recordSnapshot(storageId);

  console.log("Production snapshot stored");
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Production snapshot failed",
  );
  process.exitCode = 1;
});