import { useLocalStorage } from "../hooks/useLocalStorage";
import { THEME_STORAGE_KEY } from "../keys/localStorage";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";

export type AppLayoutContext = {
  isDark: boolean;
  onToggleTheme: () => void;
};

export function AppLayout() {
  const [storedThemeDark, setStoredThemeDark] = useLocalStorage(
    THEME_STORAGE_KEY,
    "false",
  );
  const isDark = storedThemeDark === "true";

  useEffect(() => {
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.backgroundColor = "#000000";
  }, []);

  return (
    <div className={isDark ? "theme-dark" : ""}>
      <Outlet
        context={{
          isDark,
          onToggleTheme: () => setStoredThemeDark((v) => String(v !== "true")),
        }}
      />
    </div>
  );
}