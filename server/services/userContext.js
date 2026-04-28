import { verifyFirebaseIdToken } from "../firebaseAdmin.js";
import { getUserStoreRepository } from "../storage/userStore.js";
import { getUsernameFromEmail, validateUsername } from "../utils/common.js";

function getVerifier(req) {
  return req.app.locals.verifyIdToken ?? verifyFirebaseIdToken;
}

function getRepository(req) {
  return req.app.locals.userStoreRepository ?? getUserStoreRepository();
}

export function getAuthProfileSync(req) {
  return req.app.locals.syncAuthProfile ?? (async () => undefined);
}

function parseBearerToken(headerValue) {
  const value = String(headerValue ?? "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function buildAuthUserFromToken(decodedToken) {
  const usernameResult = validateUsername(decodedToken.name);
  const username =
    "username" in usernameResult
      ? usernameResult.username
      : getUsernameFromEmail(decodedToken.email);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email ?? null,
    displayName: username,
    photoURL: decodedToken.picture ?? null,
  };
}

export async function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: "Missing authorization token." });
      return;
    }

    const decodedToken = await getVerifier(req)(token);
    req.authUser = {
      ...buildAuthUserFromToken(decodedToken),
      idToken: token,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired session." });
  }
}

export async function readUserStore(req, options) {
  return getRepository(req).readUserStore(req.authUser, options);
}

export async function updateUserStore(req, updater, options) {
  return getRepository(req).updateUserStore(req.authUser, updater, options);
}
