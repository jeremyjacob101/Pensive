import { execFileSync } from "node:child_process";

const before = process.argv[2];
const after = process.argv[3];

if (!before || !after) {
  throw new Error(
    "Usage: node scripts/convex-schema-changed.mjs <before> <after>",
  );
}

const changedFiles = execFileSync(
  "git",
  ["diff", "--name-only", before, after, "--", "convex/schema.ts"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

process.stdout.write(
  changedFiles.includes("convex/schema.ts") ? "true\n" : "false\n",
);