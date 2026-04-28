import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

let cachedApp = null;
let cachedAuth = null;
let cachedDb = null;

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

function parseServiceAccountJson(rawJson, source) {
  let serviceAccount;

  try {
    serviceAccount = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`${source} must be valid Firebase service account JSON.`);
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = String(serviceAccount.private_key).replace(
      /\\n/g,
      "\n",
    );
  }

  return serviceAccount;
}

function readServiceAccountFile(filePath) {
  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Firebase service account file not found: ${filePath}`);
  }

  return parseServiceAccountJson(
    readFileSync(resolvedPath, "utf8"),
    `Firebase service account file ${filePath}`,
  );
}

function readLocalServiceAccountFile() {
  const candidatePaths = [
    resolve(process.cwd(), ".env"),
    resolve(moduleDirectory, ".env"),
    resolve(moduleDirectory, "..", ".env"),
  ];
  const uniquePaths = [...new Set(candidatePaths)];

  for (const filePath of uniquePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const rawJson = readFileSync(filePath, "utf8");

    if (rawJson.trimStart().startsWith("{")) {
      return parseServiceAccountJson(rawJson, filePath);
    }
  }

  return null;
}

function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (rawJson) {
    return parseServiceAccountJson(rawJson, "FIREBASE_SERVICE_ACCOUNT");
  }

  const serviceAccountFile =
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountFile) {
    return readServiceAccountFile(serviceAccountFile);
  }

  const localServiceAccount = readLocalServiceAccountFile();

  if (localServiceAccount) {
    return localServiceAccount;
  }

  throw new Error(
    "Missing Firebase service account credentials. Add FIREBASE_SERVICE_ACCOUNT to the backend environment, or set FIREBASE_SERVICE_ACCOUNT_FILE/GOOGLE_APPLICATION_CREDENTIALS for local development.",
  );
}

export function getFirebaseAdminApp() {
  if (cachedApp) {
    return cachedApp;
  }

  cachedApp =
    getApps()[0] ??
    initializeApp({
      credential: cert(parseServiceAccount()),
    });

  return cachedApp;
}

export function getFirebaseAdminAuth() {
  cachedAuth ??= getAuth(getFirebaseAdminApp());
  return cachedAuth;
}

export function getFirebaseAdminDb() {
  cachedDb ??= getFirestore(getFirebaseAdminApp());
  return cachedDb;
}

export async function verifyFirebaseIdToken(idToken) {
  return getFirebaseAdminAuth().verifyIdToken(idToken);
}
