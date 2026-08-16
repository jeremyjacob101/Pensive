import { writeFileSync } from "node:fs";

const outputPath = process.env.DEPLOYMENT_URL_OUTPUT;
const deploymentUrl = process.env.COMPAT_CONVEX_URL;

if (!outputPath || !deploymentUrl) {
  throw new Error("DEPLOYMENT_URL_OUTPUT and COMPAT_CONVEX_URL are required");
}

writeFileSync(outputPath, `${deploymentUrl.trim()}\n`, "utf8");