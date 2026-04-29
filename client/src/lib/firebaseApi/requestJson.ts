import type { AuthUser } from "../../features/finance/types";
import {
  getCurrentAuthUser,
  signInWithFirebase,
  signUpWithFirebase,
  updateCurrentProfile,
} from "./auth";
import { requestServerJson } from "./serverApi";
import { assertFirebaseConfigured, throwIfAborted } from "./shared";

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  username?: string | null,
): Promise<T> {
  assertFirebaseConfigured();
  void username;
  throwIfAborted(init?.signal);

  const url = new URL(path, "https://local.app");
  const method = (init?.method ?? "GET").toUpperCase();
  const pathnameWithSearch = url.pathname;

  if (url.pathname === "/auth/signup" && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    return signUpWithFirebase(body) as Promise<T>;
  }

  if (url.pathname === "/auth/login" && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    return signInWithFirebase(body) as Promise<T>;
  }

  if (
    (url.pathname === "/auth/me" || url.pathname === "/profile") &&
    method === "GET"
  ) {
    return getCurrentAuthUser() as Promise<T>;
  }

  if (url.pathname === "/profile" && method === "PUT") {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<
      string,
      unknown
    >;
    return updateCurrentProfile(body) as Promise<T>;
  }

  return requestServerJson<T>(pathnameWithSearch, init);
}

export type { AuthUser };
