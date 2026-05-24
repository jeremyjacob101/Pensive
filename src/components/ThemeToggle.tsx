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
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          style={{ color: isDark ? "#facc15" : "#0f172a" }}
        >
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <path
            d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="left-menu-label">{nextModeLabel}</span>
    </button>
  );
}
