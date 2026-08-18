import { spawnSync } from "node:child_process";

const useProd = process.argv.includes("--prod");
const batchSizeIndex = process.argv.indexOf("--batch-size");
const requestedBatchSize =
  batchSizeIndex >= 0 ? Number(process.argv[batchSizeIndex + 1]) : 100;
const batchSize = Number.isFinite(requestedBatchSize)
  ? Math.max(1, Math.min(Math.floor(requestedBatchSize), 500))
  : 100;

const tables = ["expenses", "incomings", "recurrings"];

function runBatch(table) {
  const args = [
    "convex",
    "run",
    "amountMigrations:backfillBatch",
    JSON.stringify({ table, batchSize }),
  ];
  if (useProd) args.push("--prod");

  const result = spawnSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Backfill failed for ${table}`);
  }

  const lines = result.stdout
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
  throw new Error(`Convex did not return a backfill result for ${table}`);
}

for (const table of tables) {
  let totalPatched = 0;
  let result;
  do {
    result = runBatch(table);
    totalPatched += result.patched;
    console.log(
      `${table}: scanned ${result.scanned}, patched ${result.patched}`,
    );
  } while (!result.done);
  console.log(`${table}: complete (${totalPatched} rows patched)`);
}