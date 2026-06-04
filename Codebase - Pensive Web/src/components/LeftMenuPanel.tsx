import { ChartNoAxesColumnDecreasing, ListChecks, MoveDownLeft, MoveUpRight, NotebookPen, RotateCw, SlidersHorizontal, User } from "lucide-react";
import type { MenuItem, MenuItemKey } from "../types/ui";
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
            <User size={16} strokeWidth={2.2} color="currentColor" />
          </span>
          <span className="left-menu-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

function menuIcon(key: MenuItemKey): ReactNode {
  if (key === "expenses") {
    return <MoveUpRight size={16} strokeWidth={2.4} color="#ef4444" />;
  }
  if (key === "incomings") {
    return <MoveDownLeft size={16} strokeWidth={2.4} color="#22c55e" />;
  }
  if (key === "breakdown") {
    return (
      <ChartNoAxesColumnDecreasing
        size={16}
        strokeWidth={2.2}
        color="#38bdf8"
      />
    );
  }
  if (key === "recurrings") {
    return <RotateCw size={16} strokeWidth={2.2} color="#f97316" />;
  }
  if (key === "tracking") {
    return <ListChecks size={16} strokeWidth={2.2} color="#a855f7" />;
  }
  if (key === "notepad") {
    return <NotebookPen size={16} strokeWidth={2.2} color="#eab308" />;
  }
  return <SlidersHorizontal size={16} strokeWidth={2.2} color="#ec4899" />;
}