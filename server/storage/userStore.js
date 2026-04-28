import { getFirebaseAdminDb } from "../firebaseAdmin.js";
import { normalizeStoredUserStore } from "../services/normalizers.js";
import { cleanOptionalString, getUsernameFromEmail } from "../utils/common.js";

const USER_COLLECTION = "financeUsers";

export function getUserStoreRepository() {
  const db = getFirebaseAdminDb();

  function deriveUsername(authUser) {
    return (
      cleanOptionalString(authUser.displayName) ??
      getUsernameFromEmail(authUser.email)
    );
  }

  function buildInitialStore(authUser) {
    const username = deriveUsername(authUser);
    const now = new Date().toISOString();

    return normalizeStoredUserStore(
      username,
      {
        profile: {
          username,
          fullName: cleanOptionalString(authUser.displayName) ?? username,
          email: authUser.email ?? null,
          pictureUrl: cleanOptionalString(authUser.photoURL),
          createdAt: now,
          updatedAt: now,
        },
      },
      authUser.email,
    );
  }

  async function readUserStore(authUser, options = {}) {
    const documentRef = db
      .collection(USER_COLLECTION)
      .doc(authUser.storeId ?? authUser.uid);
    const snapshot = await documentRef.get();
    const rawStore = snapshot.exists ? snapshot.data() : null;
    const store = rawStore
      ? normalizeStoredUserStore(
          deriveUsername(authUser),
          rawStore,
          authUser.email,
        )
      : buildInitialStore(authUser);
    let shouldPersist = !rawStore;
    void options;

    if (shouldPersist) {
      await documentRef.set(store);
    }

    return store;
  }

  async function updateUserStore(authUser, updater, options = {}) {
    const documentRef = db
      .collection(USER_COLLECTION)
      .doc(authUser.storeId ?? authUser.uid);
    const snapshot = await documentRef.get();
    const rawStore = snapshot.exists ? snapshot.data() : null;
    const store = rawStore
      ? normalizeStoredUserStore(
          deriveUsername(authUser),
          rawStore,
          authUser.email,
        )
      : buildInitialStore(authUser);
    void options;

    const result = await updater(store, { authUser });
    await documentRef.set(store);
    return result;
  }

  return {
    readUserStore,
    updateUserStore,
  };
}
