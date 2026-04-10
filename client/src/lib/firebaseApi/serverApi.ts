import { auth } from "../../firebase";
import { assertFirebaseConfigured, throwIfAborted } from "./shared";

const API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH ?? "/api";

function buildApiUrl(path: string) {
  return `${API_BASE_PATH}${path}`;
}

function mergeHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (
    init?.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function getCurrentIdToken() {
  assertFirebaseConfigured();

  if (!auth.currentUser) {
    throw new Error("Please sign in first.");
  }

  return auth.currentUser.getIdToken();
}

export async function requestServerJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  throwIfAborted(init?.signal);

  const token = await getCurrentIdToken();
  const headers = mergeHeaders(init);
  headers.set("Authorization", `Bearer ${token}`);

  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      headers,
    });
  } catch (error) {
    throwIfAborted(init?.signal);

    if (error instanceof Error) {
      throw new Error(
        "Node backend unavailable. Start the server on port 3001 and try again.",
      );
    }

    throw error;
  }

  throwIfAborted(init?.signal);

  let payload: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { error: text } : null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : response.status >= 502
          ? "Node backend unavailable. Start the server on port 3001 and try again."
          : response.status === 401
            ? "Please sign in first."
            : "Request failed.";

    throw new Error(message);
  }

  return payload as T;
}
