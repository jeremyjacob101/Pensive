import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const envPath = resolve(repositoryRoot, ".env.local");
const DEFAULT_PRIMARY_USERNAME = "jeremyjacob101";
const DEFAULT_SEED = "20260818";
const DEFAULT_AS_OF_DATE = "2026-08-18";

function usage() {
  console.log(`Usage:
  npm run dev:db:seed
  npm run dev:db:seed -- [options]

Options:
  --user-id <id>       Optional user override; otherwise the primary dev user is selected automatically.
  --profile <name>     realistic (default) or stress.
  --seed <number>      Deterministic generator seed (default: ${DEFAULT_SEED}).
  --as-of <date>       Inclusive YYYY-MM-DD data endpoint (default: ${DEFAULT_AS_OF_DATE}).
  --yes                Optional backwards-compatible acknowledgement.
  --list-users         Read-only list of auth users in the configured dev deployment.
  --help               Show this help.

The runner always targets the deployment configured as CONVEX_DEPLOYMENT=dev:... in .env.local.
It refuses to run when that file points at a production or non-dev deployment.
With no --user-id, it prefers ${DEFAULT_PRIMARY_USERNAME} and otherwise chooses the first non-test user.`);
}

function readLocalConfig() {
  if (!existsSync(envPath)) {
    throw new Error(`Missing ${envPath}. Run npm run convex:dev first.`);
  }
  const values = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function takeValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`${flag} requires a value`);
  return value;
}

const cliEnvironment = {
  ...process.env,
  CI: "1",
  CONVEX_DISABLE_TELEMETRY: "1",
};

function runConvex(argumentsList) {
  const result = spawnSync("npx", ["convex", "run", ...argumentsList], {
    cwd: repositoryRoot,
    env: cliEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function parseJsonOutput(output, label) {
  const trimmed = output.trim();
  const jsonCandidates = ["{", "["]
    .map((character) => trimmed.indexOf(character))
    .filter((index) => index >= 0);
  const firstJsonCharacter = jsonCandidates.length
    ? Math.min(...jsonCandidates)
    : -1;
  if (firstJsonCharacter < 0) {
    throw new Error(`Convex call returned no JSON: ${label}`);
  }
  return JSON.parse(trimmed.slice(firstJsonCharacter));
}

function runConvexJson(
  functionName,
  payload,
  { push = false, typecheck = "disable", codegen = "disable" } = {},
) {
  const argumentsList = [
    "--deployment",
    "dev",
    functionName,
    JSON.stringify(payload),
    ...(push ? ["--push"] : []),
    "--typecheck",
    typecheck,
    "--codegen",
    codegen,
  ];
  const result = spawnSync("npx", ["convex", "run", ...argumentsList], {
    cwd: repositoryRoot,
    env: cliEnvironment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
    throw new Error(details || `Convex call failed: ${functionName}`);
  }
  return parseJsonOutput(result.stdout, functionName);
}

function runInlineQueryJson(inlineQuery) {
  const result = spawnSync(
    "npx",
    [
      "convex",
      "run",
      "--deployment",
      "dev",
      "--inline-query",
      inlineQuery,
      "--typecheck",
      "disable",
      "--codegen",
      "disable",
    ],
    {
      cwd: repositoryRoot,
      env: cliEnvironment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim();
    throw new Error(details || "Development user lookup failed");
  }
  return parseJsonOutput(result.stdout, "development user lookup");
}

function resolveDefaultUser() {
  const inlineQuery = `
const users = await ctx.db.query("users").collect();
const byUsername = (left, right) =>
  (left.username ?? "").localeCompare(right.username ?? "");
const preferred = users.find(
  (user) => user.username === "${DEFAULT_PRIMARY_USERNAME}",
);
const nonTestUsers = users
  .filter(
    (user) =>
      user.username && !/^(test|testing|qa|codex)/i.test(user.username),
  )
  .sort(byUsername);
const selected =
  preferred ?? nonTestUsers[0] ?? users.slice().sort(byUsername)[0] ?? null;
return selected
  ? { _id: selected._id, username: selected.username ?? null }
  : null;
`;
  const selected = runInlineQueryJson(inlineQuery);
  if (!selected?._id) {
    throw new Error(
      "No development auth user exists. Create a dev user before seeding.",
    );
  }
  return selected;
}

function publishDevFunctions(userId) {
  runConvexJson(
    "internal.devSeed.verify",
    { userId },
    { push: true, typecheck: "enable", codegen: "enable" },
  );
}

function runSeedBatch(functionName, generatedArgs, batchSize, onRows) {
  let batchIndex = 0;
  let done = false;
  let total = 0;
  while (!done) {
    const result = runConvexJson(functionName, {
      ...generatedArgs,
      batchIndex,
      batchSize,
    });
    onRows(result.rows ?? []);
    done = result.done;
    total = result.total ?? total;
    batchIndex += 1;
  }
  return { batches: batchIndex, total };
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  usage();
  process.exit(0);
}

try {
  const config = readLocalConfig();
  const deployment = config.CONVEX_DEPLOYMENT ?? "";
  if (!deployment.startsWith("dev:")) {
    throw new Error(
      `Refusing to run: CONVEX_DEPLOYMENT must start with dev:, received ${deployment || "<missing>"}.`,
    );
  }

  if (args.includes("--list-users")) {
    const inlineQuery =
      'return (await ctx.db.query("users").collect()).map(({_id, name, username}) => ({_id, name: name ?? null, username: username ?? null}));';
    runConvex([
      "--deployment",
      "dev",
      "--inline-query",
      inlineQuery,
      "--typecheck",
      "disable",
    ]);
    process.exit(0);
  }

  const requestedUserId = takeValue(args, "--user-id");
  const profile = takeValue(args, "--profile") ?? "realistic";
  const seedText = takeValue(args, "--seed") ?? DEFAULT_SEED;
  const asOfDate = takeValue(args, "--as-of") ?? DEFAULT_AS_OF_DATE;

  if (profile !== "realistic" && profile !== "stress") {
    throw new Error("--profile must be realistic or stress");
  }
  if (!/^-?\d+$/.test(seedText)) throw new Error("--seed must be an integer");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    throw new Error("--as-of must be YYYY-MM-DD");
  }
  const selectedUser = requestedUserId
    ? { _id: requestedUserId, username: null }
    : resolveDefaultUser();
  const userId = selectedUser._id;

  console.log(
    `Seeding ${deployment} with the ${profile} profile for ${selectedUser.username ?? userId}.`,
  );
  if (!requestedUserId) {
    console.log("The primary development user was selected automatically.");
  }
  console.log(
    "Auth users and credentials will be preserved; application data will be replaced.",
  );

  publishDevFunctions(userId);

  const generatedArgs = {
    userId,
    profile,
    seed: Number(seedText),
    asOfDate,
  };
  const clearOrder = [
    "paybackLinks",
    "expenses",
    "incomings",
    "userOptions",
    "recurrings",
    "notepadWorkspaces",
    "savingsEntries",
    "savingsBanks",
    "savingsSettings",
    "savingsExchangeRates",
  ];
  for (const table of clearOrder) {
    let done = false;
    while (!done) {
      const result = runConvexJson("internal.devSeed.clearTableBatch", {
        table,
        batchSize: 500,
      });
      done = result.done;
    }
  }

  const options = runConvexJson("internal.devSeed.seedOptions", generatedArgs);
  console.log(`Inserted ${options.inserted} user options.`);

  const expenseIds = new Map();
  const expenseBatches = runSeedBatch(
    "internal.devSeed.seedExpenseBatch",
    generatedArgs,
    200,
    (rows) => rows.forEach((row) => expenseIds.set(row.key, row.id)),
  );
  console.log(
    `Inserted ${expenseBatches.total} expenses in ${expenseBatches.batches} batches.`,
  );

  const incomingIds = new Map();
  const incomingBatches = runSeedBatch(
    "internal.devSeed.seedIncomingBatch",
    generatedArgs,
    200,
    (rows) => rows.forEach((row) => incomingIds.set(row.key, row.id)),
  );
  console.log(
    `Inserted ${incomingBatches.total} incomings in ${incomingBatches.batches} batches.`,
  );

  const createdAt = Date.parse(`${asOfDate}T12:00:00.000Z`);
  let paybackBatchIndex = 0;
  let paybackDone = false;
  let paybackTotal = 0;
  while (!paybackDone) {
    const generated = runConvexJson("internal.devSeed.getPaybackBatch", {
      ...generatedArgs,
      batchIndex: paybackBatchIndex,
      batchSize: 200,
    });
    const rows = generated.links.map((link) => {
      const expenseId = expenseIds.get(link.expenseKey);
      const incomingId = incomingIds.get(link.incomingKey);
      if (!expenseId || !incomingId) {
        throw new Error(
          "Generated payback link references an inserted row that is missing locally",
        );
      }
      return {
        expenseId,
        incomingId,
        allocatedAmount: link.allocatedAmount,
        notes: link.notes,
      };
    });
    if (rows.length > 0) {
      runConvexJson("internal.devSeed.insertPaybackLinks", {
        userId,
        createdAt,
        rows,
      });
    }
    paybackDone = generated.done;
    paybackTotal = generated.total;
    paybackBatchIndex += 1;
  }
  console.log(`Inserted ${paybackTotal} payback links.`);

  const supporting = runConvexJson(
    "internal.devSeed.seedSupportingData",
    generatedArgs,
  );
  console.log(
    `Inserted ${supporting.recurrings} recurrings, ${supporting.notes} notes, ${supporting.tables} tables, ${supporting.savingsBanks} savings banks, and ${supporting.savingsEntries} savings entries.`,
  );

  const verification = runConvexJson("internal.devSeed.verify", { userId });
  console.log(JSON.stringify(verification, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  usage();
  process.exit(1);
}