import {
  getDoc,
  runTransaction,
  setDoc,
  type Transaction,
} from "firebase/firestore";
import {
  cleanOptionalString,
  normalizeStoredUserStore,
  type UserStore,
} from "../../features/finance/storeModel";
import { db } from "../../firebase";
import {
  getUserRef,
  getUsernameFromEmail,
  requireAuthenticatedUser,
  type FirebaseUser,
} from "./shared";

export async function getUserStoreForUser(user: FirebaseUser) {
  const snap = await getDoc(getUserRef(user.uid));
  const data = snap.data();
  const username =
    cleanOptionalString(data?.profile?.username) ??
    cleanOptionalString(user.displayName) ??
    getUsernameFromEmail(user.email);

  if (!username) {
    throw new Error("Unable to resolve your username.");
  }

  const userStore = normalizeStoredUserStore(username, data, user.email);
  return userStore;
}

export async function ensureUserStore(user: FirebaseUser) {
  const userRef = getUserRef(user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return getUserStoreForUser(user);
  }

  const username =
    cleanOptionalString(user.displayName) ?? getUsernameFromEmail(user.email);
  const now = new Date().toISOString();
  const userStore = normalizeStoredUserStore(
    username,
    {
      profile: {
        username,
        fullName: cleanOptionalString(user.displayName) ?? username,
        email: user.email,
        pictureUrl: cleanOptionalString(user.photoURL),
        createdAt: now,
        updatedAt: now,
      },
    },
    user.email,
  );

  await setDoc(userRef, userStore);

  return userStore;
}

export async function withUserStoreTransaction<T>(
  updater: (
    store: UserStore,
    transaction: Transaction,
    user: FirebaseUser,
  ) => T,
  options: { skipRecurring?: boolean } = {},
) {
  const user = requireAuthenticatedUser();

  return runTransaction(db, async (transaction) => {
    const userRef = getUserRef(user.uid);
    const snap = await transaction.get(userRef);
    const store = normalizeStoredUserStore(
      cleanOptionalString(snap.data()?.profile?.username) ??
        cleanOptionalString(user.displayName) ??
        getUsernameFromEmail(user.email),
      snap.data(),
      user.email,
    );
    void options;

    const result = updater(store, transaction, user);
    transaction.set(userRef, store);
    return result;
  });
}
