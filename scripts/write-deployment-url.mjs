import { writeFileSync } from "node:fs";

const outputPath = process.env.DEPLOYMENT_URL_OUTPUT;
const deploymentUrl = process.env.COMPAT_CONVEX_URL;
const siteOutputPath = process.env.DEPLOYMENT_SITE_URL_OUTPUT;
const siteUrl = process.env.VITE_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL;

if (!outputPath || !deploymentUrl) {
  throw new Error("DEPLOYMENT_URL_OUTPUT and COMPAT_CONVEX_URL are required");
}
if (siteOutputPath && !siteUrl) {
  throw new Error(
    "VITE_CONVEX_SITE_URL or CONVEX_SITE_URL is required when DEPLOYMENT_SITE_URL_OUTPUT is set",
  );
}

writeFileSync(outputPath, `${deploymentUrl.trim()}\n`, "utf8");
if (siteOutputPath) {
  writeFileSync(siteOutputPath, `${siteUrl.trim()}\n`, "utf8");
}