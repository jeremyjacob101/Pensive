import { useEffect, useState } from "react";

export function useLocalStorage(
  key: string,
  defaultValue: string,
): [string, (value: string | ((prev: string) => string)) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return defaultValue;
    return window.localStorage.getItem(key) ?? defaultValue;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue];
}