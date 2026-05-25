import { type SyntheticEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRedirectTarget } from "../helpers/authRedirect";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ThemeToggle } from "../components/ThemeToggle";
import { THEME_STORAGE_KEY } from "../keys/theme";
import { useAuth } from "../context/useAuth";

export function LoginPage() {
  const { signInPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [storedThemeDark, setStoredThemeDark] = useLocalStorage(
    THEME_STORAGE_KEY,
    "false",
  );
  const isDark = storedThemeDark === "true";

  useEffect(() => {
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.backgroundColor = "#000000";
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInPassword({ email: username, password, flow: mode });
      const from = getRedirectTarget(location.state);
      navigate(from || "/expenses", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={isDark ? "theme-dark" : ""}>
      <main className="page">
        <div className="toolbar">
          <ThemeToggle
            isDark={isDark}
            onToggle={() => setStoredThemeDark((v) => String(v !== "true"))}
          />
        </div>
        <h1>Pensive</h1>
        <form className="entry-form" onSubmit={onSubmit}>
          <input
            name="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "signIn"
                ? "Sign In"
                : "Create Account"}
          </button>
          <button
            type="button"
            onClick={() =>
              setMode((prev) => (prev === "signIn" ? "signUp" : "signIn"))
            }
          >
            {mode === "signIn"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
          {error ? <p>{error}</p> : null}
        </form>
      </main>
    </div>
  );
}