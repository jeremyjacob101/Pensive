const { getDocument, setDocument } = require("../firebaseRest");
const { normalizeStoredUserStore } = require("../services/normalizers");
const {
  cleanOptionalString,
  getUsernameFromEmail,
} = require("../utils/common");

const USER_COLLECTION = "financeUsers";

function getUserStoreRepository() {
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
    const documentPath = `${USER_COLLECTION}/${authUser.uid}`;
    const rawStore = await getDocument(documentPath, authUser.idToken);
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
      await setDocument(documentPath, authUser.idToken, store);
    }

    return store;
  }

  async function updateUserStore(authUser, updater, options = {}) {
    const documentPath = `${USER_COLLECTION}/${authUser.uid}`;
    const rawStore = await getDocument(documentPath, authUser.idToken);
    const store = rawStore
      ? normalizeStoredUserStore(
          deriveUsername(authUser),
          rawStore,
          authUser.email,
        )
      : buildInitialStore(authUser);
    void options;

    const result = await updater(store, { authUser });
    await setDocument(documentPath, authUser.idToken, store);
    return result;
  }

  return {
    readUserStore,
    updateUserStore,
  };
}

module.exports = {
  getUserStoreRepository,
};
