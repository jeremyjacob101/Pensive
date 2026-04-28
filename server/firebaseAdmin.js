import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let cachedApp = null;
let cachedAuth = null;
let cachedDb = null;

function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!rawJson) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT. Add the Firebase service account JSON to the backend Vercel project.",
    );
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(rawJson);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON.");
  }

  if (serviceAccount.private_key) {
    serviceAccount.private_key = String(serviceAccount.private_key).replace(
      /\\n/g,
      "\n",
    );
  }

  return serviceAccount;
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
