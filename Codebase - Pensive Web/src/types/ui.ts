export type MenuItemKey =
  | "expenses"
  | "incomings"
  | "breakdown"
  | "recurrings"
  | "tracking"
  | "notepad"
  | "savings"
  | "options";

export type MenuItem = {
  key: MenuItemKey;
  label: string;
};

export const layoutMenuItems: MenuItem[] = [
  { key: "expenses", label: "Expenses" },
  { key: "incomings", label: "Incomings" },
  { key: "breakdown", label: "Breakdown" },
  { key: "recurrings", label: "Recurrings" },
  { key: "tracking", label: "Tracking" },
  { key: "notepad", label: "Notepad" },
  { key: "savings", label: "Savings" },
  { key: "options", label: "Options" },
];
