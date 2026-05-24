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

export type TopRowSearchState = {
  expenseSearchQuery: string;
  setExpenseSearchQuery: (value: string) => void;
  expenseSelectedSearchFields: string[];
  setExpenseSelectedSearchFields: (value: string[]) => void;
  incomingSearchQuery: string;
  setIncomingSearchQuery: (value: string) => void;
  incomingSelectedSearchFields: string[];
  setIncomingSelectedSearchFields: (value: string[]) => void;
};

export function AppLayout() {
  const [storedThemeDark, setStoredThemeDark] = useLocalStorage(
    THEME_STORAGE_KEY,
    "false",
  );
  const [formType, setFormType] = useState<FormType>(null);
  const [saving, setSaving] = useState(false);
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [incomingSearchQuery, setIncomingSearchQuery] = useState("");
  const [expenseSelectedSearchFields, setExpenseSelectedSearchFields] =
    useState<string[]>(["expense"]);
  const [incomingSelectedSearchFields, setIncomingSelectedSearchFields] =
    useState<string[]>(["incoming"]);

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
  const expenseSearchFieldOptions = [
    { value: "expense", label: "Name" },
    { value: "paidTo", label: "Paid To" },
    { value: "category", label: "Category" },
    { value: "subcategory", label: "Subcategory" },
    { value: "type", label: "Type" },
    { value: "account", label: "Account" },
    { value: "notes", label: "Notes" },
    { value: "comments", label: "Comments" },
    { value: "baseExpenseLabel", label: "Group Name" },
  ];
  const incomingSearchFieldOptions = [
    { value: "incoming", label: "Name" },
    { value: "paidBy", label: "Paid By" },
    { value: "incomeType", label: "Income Type" },
    { value: "incomeSubtype", label: "Income Subtype" },
    { value: "account", label: "Account" },
    { value: "notes", label: "Notes" },
    { value: "comments", label: "Comments" },
  ];

  useEffect(() => {
    document.documentElement.style.backgroundColor = "#000000";
    document.body.style.backgroundColor = "#000000";
  }, []);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", isDark);
    document.documentElement.classList.toggle("theme-dark", isDark);

    return () => {
      document.body.classList.remove("theme-dark");
      document.documentElement.classList.remove("theme-dark");
    };
  }, [isDark]);

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
              searchQuery={
                activeItem === "incomings"
                  ? incomingSearchQuery
                  : expenseSearchQuery
              }
              onSearchQueryChange={
                activeItem === "incomings"
                  ? setIncomingSearchQuery
                  : setExpenseSearchQuery
              }
              searchFieldOptions={
                activeItem === "incomings"
                  ? incomingSearchFieldOptions
                  : expenseSearchFieldOptions
              }
              selectedSearchFields={
                activeItem === "incomings"
                  ? incomingSelectedSearchFields
                  : expenseSelectedSearchFields
              }
              onSearchFieldsChange={
                activeItem === "incomings"
                  ? setIncomingSelectedSearchFields
                  : setExpenseSelectedSearchFields
              }
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
            <Outlet
              context={{
                expenseSearchQuery,
                setExpenseSearchQuery,
                expenseSelectedSearchFields,
                setExpenseSelectedSearchFields,
                incomingSearchQuery,
                setIncomingSearchQuery,
                incomingSelectedSearchFields,
                setIncomingSelectedSearchFields,
              } satisfies TopRowSearchState}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
