export type MenuItemKey = "expenses" | "incomings" | "recurrings" | "options";

export type MenuItem = {
  key: MenuItemKey;
  label: string;
};

export type LeftMenuPanelProps = {
  items: MenuItem[];
  activeItem: MenuItemKey;
  onSelect: (item: MenuItemKey) => void;
  onUserClick: () => void;
};
