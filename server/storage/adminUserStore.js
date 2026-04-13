import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeStoredUserStore } from "../services/normalizers.js";

const USER_COLLECTION = "financeUsers";

let cachedDb = null;

function getServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!rawJson) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON for admin batch access.");
  }

  const parsed = JSON.parse(rawJson);
  parsed.private_key = String(parsed.private_key ?? "").replace(/\\n/g, "\n");
  return parsed;
}

function getAdminDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(getServiceAccount()),
    });

  cachedDb = getFirestore(app);
  return cachedDb;
}

export function getAdminUserStoreRepository() {
  const db = getAdminDb();

  return {
    async listUserStores() {
      const snapshot = await db.collection(USER_COLLECTION).get();

      return snapshot.docs.map((doc) => {
        const rawStore = doc.data();
        const fallbackEmail =
          typeof rawStore?.profile?.email === "string" ? rawStore.profile.email : null;
        const username =
          typeof rawStore?.profile?.username === "string" && rawStore.profile.username.trim()
            ? rawStore.profile.username
            : doc.id;

        return {
          uid: doc.id,
          store: normalizeStoredUserStore(username, rawStore, fallbackEmail),
        };
      });
    },
    async saveUserStore(uid, store) {
      await db.collection(USER_COLLECTION).doc(uid).set(store);
    },
  };
}
