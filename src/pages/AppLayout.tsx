import { handleAddExpense, handleAddIncoming, handleAddRecurring } from "./actions";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AddEntryPanel } from "../components/AddEntryPanel";
import { LeftMenuPanel } from "../components/LeftMenuPanel";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { THEME_STORAGE_KEY } from "../keys/localStorage";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import type { FormType } from "../types/workspace";
import { api } from "../../convex/_generated/api";
import type { MenuItemKey } from "../types/ui";
import { useAuth } from "../context/useAuth";

const layoutMenuItems: Array<{ key: MenuItemKey; label: string }> = [
  { key: "expenses", label: "Expenses" },
  { key: "incomings", label: "Incomings" },
  { key: "recurrings", label: "Recurrings" },
  { key: "options", label: "Options" },
];
const OPTION_COLOR_BACKFILL_V1_KEY = "option-color-backfill-v1-complete";

export function AppLayout() {
  const [storedThemeDark, setStoredThemeDark] = useLocalStorage(
    THEME_STORAGE_KEY,
    "false",
  );
  const [formType, setFormType] = useState<FormType>(null);
  const [saving, setSaving] = useState(false);

  const createExpense = useMutation(api.expenses.create);
  const createIncoming = useMutation(api.incomings.create);
  const createRecurring = useMutation(api.recurrings.create);
  const addUserOption = useMutation(api.userOptions.add);
  const backfillOptionColors = useMutation(api.userOptions.backfillColors);

  const userOptions = useQuery(api.userOptions.list);
  const hasRequestedOptionColorBackfill = useRef(false);

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

  useEffect(() => {
    if (!userOptions || hasRequestedOptionColorBackfill.current) return;

    const hasColorQualityIssue = Object.values(userOptions).some((options) => {
      if (!options || options.length === 0) return false;
      const normalized = options.map(
        (option) => option.color?.toUpperCase() ?? "",
      );
      const hasMissingOrInvalid = normalized.some(
        (color) => !/^#[0-9A-F]{6}$/.test(color),
      );
      if (hasMissingOrInvalid) return true;
      if (options.length < 2) return false;
      return new Set(normalized).size <= 1;
    });

    if (
      window.localStorage.getItem(OPTION_COLOR_BACKFILL_V1_KEY) === "1" &&
      !hasColorQualityIssue
    ) {
      hasRequestedOptionColorBackfill.current = true;
      return;
    }
    hasRequestedOptionColorBackfill.current = true;
    void backfillOptionColors({ forceReassignAll: true })
      .then(() => {
        window.localStorage.setItem(OPTION_COLOR_BACKFILL_V1_KEY, "1");
      })
      .catch(() => {
        hasRequestedOptionColorBackfill.current = false;
      });
  }, [backfillOptionColors, userOptions]);

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