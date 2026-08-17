import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

const localStorageDescriptor =
  typeof window === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(window, "localStorage");

if (
  typeof window !== "undefined" &&
  (!localStorageDescriptor ||
    "get" in localStorageDescriptor ||
    typeof localStorageDescriptor.value?.getItem !== "function")
) {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });