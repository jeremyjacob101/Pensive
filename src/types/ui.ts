export type MenuItemKey =
  | "expenses"
  | "incomings"
  | "breakdown"
  | "recurrings"
  | "tracking"
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
  { key: "options", label: "Options" },
];
