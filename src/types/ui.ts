export type MenuItemKey = "expenses" | "incomings" | "recurrings" | "options";

export type MenuItem = {
  key: MenuItemKey;
  label: string;
};

export const layoutMenuItems: MenuItem[] = [
  { key: "expenses", label: "Expenses" },
  { key: "incomings", label: "Incomings" },
  { key: "recurrings", label: "Recurrings" },
  { key: "options", label: "Options" },
];
