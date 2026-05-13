import type { LeftMenuPanelProps, MenuItemKey } from "../types/ui";
import type { ReactNode } from "react";

export function LeftMenuPanel({
  items,
  activeItem,
  onSelect,
  onUserClick,
}: LeftMenuPanelProps) {
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
    </aside>
  );
}

function menuIcon(key: MenuItemKey): ReactNode {
  if (key === "expenses") return "E";
  if (key === "incomings") return "I";
  if (key === "recurrings") return "R";
  return "O";
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