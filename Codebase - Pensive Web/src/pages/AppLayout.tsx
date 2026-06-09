import { handleAddExpense, handleAddIncoming, handleAddRecurring } from "./actions";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { layoutMenuItems, type MenuItemKey } from "../types/ui";
import { AddEntryPanel } from "../components/AddEntryPanel";
import { LeftMenuPanel } from "../components/LeftMenuPanel";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { TopRowSearchState } from "../types/search";
import { useMutation, useQuery } from "convex/react";
import type { FormType } from "../types/workspace";
import { THEME_STORAGE_KEY } from "../keys/theme";
import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";
import { api } from "@pensive/convex-api";

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
  const [visibleExpenseIds, setVisibleExpenseIds] = useState<string[]>([]);
  const [visibleIncomingIds, setVisibleIncomingIds] = useState<string[]>([]);
  const [visibleExpenseCategories, setVisibleExpenseCategories] = useState<
    string[]
  >([]);
  const [visibleIncomingTypes, setVisibleIncomingTypes] = useState<string[]>(
    [],
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [deleteAccountWarningOpen, setDeleteAccountWarningOpen] =
    useState(false);
  const [accountActionPending, setAccountActionPending] = useState(false);

  const createExpense = useMutation(api.expenses.create);
  const bulkCreateExpenses = useMutation(api.expenses.bulkCreate);
  const createIncoming = useMutation(api.incomings.create);
  const bulkCreateIncomings = useMutation(api.incomings.bulkCreate);
  const createRecurring = useMutation(api.recurrings.create);
  const addUserOption = useMutation(api.userOptions.add);
  const bulkPatchVisibleExpenses = useMutation(api.expenses.bulkPatchVisible);
  const bulkPatchVisibleIncomings = useMutation(api.incomings.bulkPatchVisible);
  const deleteAccount = useMutation(api.account.deleteMine);

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

  const handleSignOut = async () => {
    setAccountActionPending(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setAccountActionPending(false);
      setAccountMenuOpen(false);
    }
  };

  const handleDeleteAccount = async () => {
    setAccountActionPending(true);
    try {
      await deleteAccount({});
      try {
        await signOut();
      } catch {
        // Deleting the account invalidates auth records; keep the local redirect moving.
      }
      navigate("/login", { replace: true });
    } finally {
      setAccountActionPending(false);
      setDeleteAccountWarningOpen(false);
      setAccountMenuOpen(false);
    }
  };

  return (
    <div className={isDark ? "theme-dark" : ""}>
      <main className="page">
        <div className="app-shell">
          <LeftMenuPanel
            items={layoutMenuItems}
            activeItem={activeItem}
            onSelect={(tab) => navigate(`/${tab}`)}
            onUserClick={() => {
              setAccountMenuOpen(true);
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
              visibleExpenseIds={visibleExpenseIds}
              visibleIncomingIds={visibleIncomingIds}
              visibleExpenseCategories={visibleExpenseCategories}
              visibleIncomingTypes={visibleIncomingTypes}
              onBulkPatchExpenses={bulkPatchVisibleExpenses}
              onBulkPatchIncomings={bulkPatchVisibleIncomings}
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
              context={
                {
                  expenseSearchQuery,
                  setExpenseSearchQuery,
                  expenseSelectedSearchFields,
                  setExpenseSelectedSearchFields,
                  incomingSearchQuery,
                  setIncomingSearchQuery,
                  incomingSelectedSearchFields,
                  setIncomingSelectedSearchFields,
                  setVisibleExpenseIds,
                  setVisibleIncomingIds,
                  setVisibleExpenseCategories,
                  setVisibleIncomingTypes,
                } satisfies TopRowSearchState
              }
            />
          </section>
        </div>
      </main>
      {accountMenuOpen && (
        <div
          className="account-action-overlay"
          onClick={() => {
            if (!accountActionPending) setAccountMenuOpen(false);
          }}
        >
          <div
            className="account-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Account actions"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="account-action-button"
              onClick={() => void handleSignOut()}
              disabled={accountActionPending}
            >
              Sign Out
            </button>
            <button
              type="button"
              className="account-action-button destructive"
              onClick={() => {
                setAccountMenuOpen(false);
                setDeleteAccountWarningOpen(true);
              }}
              disabled={accountActionPending}
            >
              Delete Account
            </button>
            <button
              type="button"
              className="account-action-button cancel"
              onClick={() => setAccountMenuOpen(false)}
              disabled={accountActionPending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {deleteAccountWarningOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!accountActionPending) setDeleteAccountWarningOpen(false);
          }}
        >
          <div
            className="modal-card account-warning-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="delete-account-title">Delete Account</h3>
            </div>
            <p id="delete-account-message" className="account-warning-text">
              This action is irrevocable and all data will be irretrievable. Are
              you sure?
            </p>
            <div className="account-warning-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteAccountWarningOpen(false)}
                disabled={accountActionPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleDeleteAccount()}
                disabled={accountActionPending}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
