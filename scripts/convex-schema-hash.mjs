import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const commit = process.argv[2];

if (!commit) {
  throw new Error("Usage: node scripts/convex-schema-hash.mjs <commit>");
}

const schema = execFileSync("git", ["show", `${commit}:convex/schema.ts`], {
  encoding: "utf8",
});

console.log(createHash("sha256").update(schema).digest("hex"));