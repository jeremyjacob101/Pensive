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
  if (key === "notepad") return <NotepadGlyph />;
  return <OptionsGlyph />;
}

function UserGlyph() {
  return <User size={16} strokeWidth={2.2} color="currentColor" />;
}

function ExpensesGlyph() {
  return <MoveUpRight size={16} strokeWidth={2.4} color="#ef4444" />;
}

function IncomingsGlyph() {
  return <MoveDownLeft size={16} strokeWidth={2.4} color="#22c55e" />;
}

function RecurringsGlyph() {
  return <RotateCw size={16} strokeWidth={2.2} color="#f97316" />;
}

function BreakdownGlyph() {
  return (
    <ChartNoAxesColumnDecreasing size={16} strokeWidth={2.2} color="#38bdf8" />
  );
}

function OptionsGlyph() {
  return <SlidersHorizontal size={16} strokeWidth={2.2} color="#ec4899" />;
}

function TrackingGlyph() {
  return <ListChecks size={16} strokeWidth={2.2} color="#a855f7" />;
}

function NotepadGlyph() {
  return <NotebookPen size={16} strokeWidth={2.2} color="#eab308" />;
}