import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedConfig = null;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return [key, value];
      }),
  );
}

export function getFirebaseClientConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const clientEnv = readEnvFile(
    path.resolve(__dirname, "../../client/.env.local"),
  );

  cachedConfig = {
    apiKey:
      process.env.FIREBASE_WEB_API_KEY ??
      process.env.VITE_FIREBASE_API_KEY ??
      clientEnv.VITE_FIREBASE_API_KEY ??
      "",
    projectId:
      process.env.FIREBASE_PROJECT_ID ??
      process.env.VITE_FIREBASE_PROJECT_ID ??
      clientEnv.VITE_FIREBASE_PROJECT_ID ??
      "",
  };

  return cachedConfig;
}
