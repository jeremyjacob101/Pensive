import { handleAddExpense, handleAddIncoming, handleAddRecurring } from "./actions";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { layoutMenuItems, type MenuItemKey } from "../types/ui";
import { AddEntryPanel } from "../components/AddEntryPanel";
import { LeftMenuPanel } from "../components/LeftMenuPanel";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { THEME_STORAGE_KEY } from "../keys/localStorage";
import { useMutation, useQuery } from "convex/react";
import type { FormType } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";

export function AppLayout() {
  const [storedThemeDark, setStoredThemeDark] = useLocalStorage(
    THEME_STORAGE_KEY,
    "false",
  );
  const [formType, setFormType] = useState<FormType>(null);
  const [saving, setSaving] = useState(false);

  const createExpense = useMutation(api.expenses.create);
  const bulkCreateExpenses = useMutation(api.expenses.bulkCreate);
  const createIncoming = useMutation(api.incomings.create);
  const bulkCreateIncomings = useMutation(api.incomings.bulkCreate);
  const createRecurring = useMutation(api.recurrings.create);
  const addUserOption = useMutation(api.userOptions.add);

  const userOptions = useQuery(api.userOptions.list);

  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = storedThemeDark === "true";

  const activeItem = (location.pathname.slice(1).split("/")[0] ||
    "expenses") as MenuItemKey;

  useEffect(() => {
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.backgroundColor = "#000000";
  }, []);

  return (
    <div className={isDark ? "theme-dark" : ""}>
      <main className="page">
        <div className="app-shell">
          <LeftMenuPanel
            items={layoutMenuItems}
            activeItem={activeItem}
            onSelect={(tab) => navigate(`/${tab}`)}
            onUserClick={() => {
              void signOut().then(() => navigate("/login", { replace: true }));
            }}
            isDark={isDark}
            onToggleTheme={() =>
              setStoredThemeDark((v) => String(v !== "true"))
            }
          />
          <section className="app-content">
            <AddEntryPanel
              activeItem={activeItem}
              formType={formType}
              setFormType={setFormType}
              onAddExpense={(e) =>
                handleAddExpense(e, {
                  createExpense,
                  addUserOption,
                  setSaving,
                  setFormType,
                  onSelectTab: (tab) => navigate(`/${tab}`),
                })
              }
              bulkCreateExpenses={bulkCreateExpenses}
              bulkCreateIncomings={bulkCreateIncomings}
              onAddIncoming={(e) =>
                handleAddIncoming(e, {
                  createIncoming,
                  addUserOption,
                  setSaving,
                  setFormType,
                  onSelectTab: (tab) => navigate(`/${tab}`),
                })
              }
              onAddRecurring={(e) =>
                handleAddRecurring(e, {
                  createRecurring,
                  setSaving,
                  setFormType,
                  onSelectTab: (tab) => navigate(`/${tab}`),
                })
              }
              saving={saving}
              userOptions={userOptions}
            />
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}