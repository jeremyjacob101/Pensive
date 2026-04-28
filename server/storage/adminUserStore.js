import { getFirebaseAdminDb } from "../firebaseAdmin.js";
import { normalizeStoredUserStore } from "../services/normalizers.js";

const USER_COLLECTION = "financeUsers";

export function getAdminUserStoreRepository() {
  const db = getFirebaseAdminDb();

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
