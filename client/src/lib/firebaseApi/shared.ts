import { auth } from "../../firebase";
import { doc } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import { db, isFirebaseConfigured } from "../../firebase";

const USER_COLLECTION = "financeUsers";
const AUTH_EMAIL_DOMAIN = "auth.local";

export function assertFirebaseConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Add the VITE_FIREBASE_* values in client/.env.local.",
    );
  }
}

export function parseBody(init?: RequestInit) {
  if (!init?.body) {
    return {};
  }

  if (typeof init.body === "string") {
    return JSON.parse(init.body) as Record<string, unknown>;
  }

  if (init.body instanceof URLSearchParams) {
    return Object.fromEntries(init.body.entries());
  }

  throw new Error("Unsupported request body.");
}

export function getUserRef(uid: string) {
  return doc(db, USER_COLLECTION, uid);
}

export function getUsernameFromEmail(email: string | null | undefined) {
  if (!email) {
    return "user";
  }

  const localPart = email.split("@")[0] ?? "user";
  return (
    localPart
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user"
  );
}

export function getAuthEmailForUsername(username: string) {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}

export function requireAuthenticatedUser() {
  assertFirebaseConfigured();

  if (!auth.currentUser) {
    throw new Error("Please sign in first.");
  }

  return auth.currentUser;
}

export function mapFirebaseAuthError(error: unknown, fallbackMessage: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return new Error("That email address is already in use.");
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return new Error("Invalid username/email or password.");
      case "auth/weak-password":
        return new Error("Password must be at least 6 characters.");
      case "auth/requires-recent-login":
        return new Error(
          "Please sign in again before changing email or password.",
        );
      case "auth/invalid-email":
        return new Error("Enter a valid email address.");
      default:
        return new Error(fallbackMessage);
    }
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}

export function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}

export function getPathPart(pathname: string, index: number) {
  const part = pathname.split("/")[index];

  if (!part) {
    throw new Error("Invalid route.");
  }

  return part;
}

export { auth, db, isFirebaseConfigured, type FirebaseUser };
