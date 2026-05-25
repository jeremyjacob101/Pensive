import type { MenuItem, MenuItemKey } from "../types/ui";
import { ListChecks } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import type { ReactNode } from "react";

export function LeftMenuPanel({ items, activeItem, onSelect, onUserClick, isDark, onToggleTheme }: {
  items: MenuItem[];
  activeItem: MenuItemKey;
  onSelect: (item: MenuItemKey) => void;
  onUserClick: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <aside className="left-menu" aria-label="Main navigation">
      <nav className="left-menu-nav">
        {items.map((item) => {
          const isActive = activeItem === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={isActive ? "left-menu-item active" : "left-menu-item"}
              onClick={() => onSelect(item.key)}
            >
              <span className="left-menu-icon" aria-hidden="true">
                {menuIcon(item.key)}
              </span>
              <span className="left-menu-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="left-menu-footer">
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        <button
          type="button"
          className="left-menu-user"
          onClick={onUserClick}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <span className="left-menu-icon" aria-hidden="true">
            <UserGlyph />
          </span>
          <span className="left-menu-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function menuIcon(key: MenuItemKey): ReactNode {
  if (key === "expenses") return <ExpensesGlyph />;
  if (key === "incomings") return <IncomingsGlyph />;
  if (key === "breakdown") return <BreakdownGlyph />;
  if (key === "recurrings") return <RecurringsGlyph />;
  if (key === "tracking") return <TrackingGlyph />;
  return <OptionsGlyph />;
}

function UserGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ExpensesGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M6 18 17 7m0 0h-6m6 0v6"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IncomingsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M18 6 7 17m0 0h6m-6 0v-6"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RecurringsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M20 8a8 8 0 1 0 2 5.3"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M20 4v4h-4"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BreakdownGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="4" y="6" width="4.6" height="14" rx="1.4" fill="#38bdf8" />
      <rect
        x="10.2"
        y="9.5"
        width="4.6"
        height="10.5"
        rx="1.4"
        fill="#38bdf8"
      />
      <rect x="16.4" y="13" width="4.6" height="7" rx="1.4" fill="#38bdf8" />
    </svg>
  );
}

function OptionsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        fill="none"
        stroke="#ec4899"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="9" cy="6" r="2.2" fill="#ec4899" />
      <circle cx="15" cy="12" r="2.2" fill="#ec4899" />
      <circle cx="11" cy="18" r="2.2" fill="#ec4899" />
    </svg>
  );
}

function TrackingGlyph() {
  return <ListChecks size={16} strokeWidth={2.2} color="#a855f7" />;
}
