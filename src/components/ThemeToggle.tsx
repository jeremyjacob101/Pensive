import { Sun } from "lucide-react";

export function ThemeToggle({ isDark, onToggle }: {
  isDark: boolean;
  onToggle: () => void;
}) {
  const nextModeLabel = isDark ? "Light Mode" : "Dark Mode";

  return (
    <button
      type="button"
      className="left-menu-item"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="left-menu-icon" aria-hidden="true">
        <Sun size={16} strokeWidth={2.2} color="currentColor" />
      </span>
      <span className="left-menu-label">{nextModeLabel}</span>
    </button>
  );
}
