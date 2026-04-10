import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile as updateAuthProfile,
  type Unsubscribe,
} from "firebase/auth";
import {
  buildAuthPayload,
  cleanOptionalString,
  hasOwn,
  normalizeAge,
  normalizeEmail,
  validatePassword,
  validateUsername,
} from "../../features/finance/storeModel";
import type { AuthUser } from "../../features/finance/types";
import { auth, isFirebaseConfigured } from "../../firebase";
import {
  assertFirebaseConfigured,
  getAuthEmailForUsername,
  mapFirebaseAuthError,
  requireAuthenticatedUser,
} from "./shared";
import { requestServerJson } from "./serverApi";

export async function signUpWithFirebase(body: Record<string, unknown>) {
  assertFirebaseConfigured();

  const usernameResult = validateUsername(body.username);

  if (usernameResult.error) {
    throw new Error(usernameResult.error);
  }

  const username = usernameResult.username;

  if (!username) {
    throw new Error("username is required");
  }

  const passwordResult = validatePassword(body.password);

  if (passwordResult.error) {
    throw new Error(passwordResult.error);
  }

  const password = passwordResult.password;

  if (!password) {
    throw new Error("password is required");
  }

  const email = normalizeEmail(body.email);
  const fullName = cleanOptionalString(body.fullName) ?? username;
  const age = normalizeAge(body.age);
  const pictureUrl = cleanOptionalString(body.pictureUrl);
  const authEmail = getAuthEmailForUsername(username);
  const createdUser = await createUserWithEmailAndPassword(
    auth,
    authEmail,
    password,
  ).catch((error) => {
    throw mapFirebaseAuthError(error, "Unable to create your account.");
  });

  try {
    await updateAuthProfile(createdUser.user, {
      displayName: username,
      photoURL: pictureUrl ?? null,
    });

    return await requestServerJson<AuthUser>("/profile", {
      method: "PUT",
      body: JSON.stringify({
        fullName,
        email,
        age,
        pictureUrl,
      }),
    });
  } catch (error) {
    await deleteUser(createdUser.user).catch(() => undefined);
    throw error instanceof Error
      ? error
      : new Error("Unable to create your account.");
  }
}

export async function signInWithFirebase(body: Record<string, unknown>) {
  assertFirebaseConfigured();

  const username = cleanOptionalString(body.username ?? body.identifier);
  const passwordResult = validatePassword(body.password);

  if (!username) {
    throw new Error("username is required");
  }

  if (passwordResult.error) {
    throw new Error(passwordResult.error);
  }

  const password = passwordResult.password;

  if (!password) {
    throw new Error("password is required");
  }

  const usernameResult = validateUsername(username);

  if (usernameResult.error || !usernameResult.username) {
    throw new Error("invalid username or password");
  }

  const authEmail = getAuthEmailForUsername(usernameResult.username);
  await signInWithEmailAndPassword(auth, authEmail, password).catch((error) => {
    throw mapFirebaseAuthError(error, "Unable to sign in.");
  });

  try {
    return await requestServerJson<AuthUser>("/auth/me");
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    throw error;
  }
}

export async function getCurrentAuthUser() {
  return requestServerJson<AuthUser>("/auth/me");
}

export async function updateCurrentProfile(body: Record<string, unknown>) {
  const firebaseUser = requireAuthenticatedUser();

  if (hasOwn(body, "newPassword") || hasOwn(body, "currentPassword")) {
    if (!firebaseUser.email) {
      throw new Error("This account cannot update password right now.");
    }

    const currentPasswordResult = validatePassword(body.currentPassword);

    if (currentPasswordResult.error || !currentPasswordResult.password) {
      throw new Error("current password is required to change password");
    }

    const credential = EmailAuthProvider.credential(
      firebaseUser.email,
      currentPasswordResult.password,
    );

    await reauthenticateWithCredential(firebaseUser, credential).catch(
      (error) => {
        throw mapFirebaseAuthError(error, "Current password is incorrect.");
      },
    );

    if (cleanOptionalString(body.newPassword)) {
      const newPasswordResult = validatePassword(body.newPassword);

      if (newPasswordResult.error || !newPasswordResult.password) {
        throw new Error(newPasswordResult.error ?? "password is required");
      }

      await updatePassword(firebaseUser, newPasswordResult.password).catch(
        (error) => {
          throw mapFirebaseAuthError(error, "Unable to update your password.");
        },
      );
    }
  }

  const updatedUser = await requestServerJson<AuthUser>("/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });

  await updateAuthProfile(firebaseUser, {
    displayName: updatedUser.username,
    photoURL: updatedUser.profile.pictureUrl ?? null,
  }).catch(() => undefined);

  return updatedUser;
}

export function observeCurrentUser(
  callback: (user: AuthUser | null) => void,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    void requestServerJson<AuthUser>("/auth/me")
      .then((user) => callback(user))
      .catch((error) => {
        console.error(error);
        callback(null);
      });
  });
}

export async function signOutCurrentUser() {
  assertFirebaseConfigured();
  await signOut(auth);
}

export { buildAuthPayload };
