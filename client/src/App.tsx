import { useEffect, useMemo } from "react";
import { AccountDialog } from "./features/finance/components/AccountDialog";
import { DashboardPage } from "./features/finance/components/DashboardPage";
import { DefaultsPage } from "./features/finance/components/DefaultsPage";
import { EntryComposer } from "./features/finance/components/EntryComposer";
import { FloatingActions } from "./features/finance/components/FloatingActions";
import { PageNav } from "./features/finance/components/PageNav";
import { TopBar } from "./features/finance/components/TopBar";
import { TransactionsPage } from "./features/finance/components/TransactionsPage";
import {
  dedupe,
  fallbackReferenceData,
} from "./features/finance/fallbacks";
import { useDefaultsActions } from "./features/finance/app/useDefaultsActions";
import { useEntryComposer } from "./features/finance/app/useEntryComposer";
import { useFinanceAuth } from "./features/finance/app/useFinanceAuth";
import { useFinanceData } from "./features/finance/app/useFinanceData";
import { useFinanceRouting } from "./features/finance/app/useFinanceRouting";
import { useRecurringManager } from "./features/finance/app/useRecurringManager";
import { useTransactionsData } from "./features/finance/app/useTransactionsData";
import { shiftMonth } from "./features/finance/utils";

export default function App() {
  const routing = useFinanceRouting();
  const {
    activePageRoute,
    closeAccountRoute,
    isAccountOpen,
    navigateTo,
    openAccountRoute,
    routeId,
  } = routing;
  const auth = useFinanceAuth({
    onAuthenticated: closeAccountRoute,
    onSignedOut: () => navigateTo("dashboard", { replace: true }),
  });
  const activeUsername = auth.currentUser?.username ?? null;
  const data = useFinanceData({ activeUsername });

  function requireAuth(action?: () => void) {
    if (!activeUsername) {
      auth.setAuthMode("login");
      auth.clearAccountStatus();
      openAccountRoute();
      return;
    }

    action?.();
  }

  const entryComposer = useEntryComposer({
    activeUsername,
    referenceData: data.referenceData,
    onRequireAuth: () => requireAuth(),
    onRefresh: data.triggerRefresh,
    selectedMonth: data.selectedMonth,
    setSelectedMonth: data.setSelectedMonth,
  });

  const availableCategories = useMemo(
    () =>
      dedupe([
        ...data.referenceData.categories[entryComposer.draft.type],
        ...fallbackReferenceData.categories[entryComposer.draft.type],
      ]),
    [data.referenceData, entryComposer.draft.type],
  );

  const availableAccounts = useMemo(
    () =>
      dedupe([
        ...data.referenceData.accounts,
        ...fallbackReferenceData.accounts,
      ]),
    [data.referenceData],
  );

  const availableSubcategories = useMemo(
    () =>
      dedupe([
        ...(data.referenceData.subcategories[entryComposer.draft.type][
          entryComposer.draft.category
        ] ?? []),
        ...(fallbackReferenceData.subcategories[entryComposer.draft.type][
          entryComposer.draft.category
        ] ?? []),
      ]),
    [
      data.referenceData,
      entryComposer.draft.category,
      entryComposer.draft.type,
    ],
  );

  const availableExpenseKinds = useMemo(
    () =>
      dedupe([
        ...data.referenceData.expenseKinds,
        ...fallbackReferenceData.expenseKinds,
      ]),
    [data.referenceData],
  );

  const availableCounterparties = useMemo(
    () =>
      dedupe([
        ...data.referenceData.counterparties[entryComposer.draft.type],
        ...fallbackReferenceData.counterparties[entryComposer.draft.type],
      ]),
    [data.referenceData, entryComposer.draft.type],
  );

  const recurring = useRecurringManager({
    activeUsername,
    referenceData: data.referenceData,
    availableExpenseKinds,
    onRefresh: data.triggerRefresh,
    onRequireAuth: () => requireAuth(),
  });

  const defaults = useDefaultsActions({
    activeUsername,
    onRefresh: data.triggerRefresh,
    onRequireAuth: () => requireAuth(),
  });
  const transactions = useTransactionsData({
    activeUsername,
    refreshToken: data.refreshToken,
  });

  useEffect(() => {
    if (!activeUsername && routeId !== "dashboard" && routeId !== "user") {
      navigateTo("dashboard", { replace: true });
    }
  }, [activeUsername, navigateTo, routeId]);

  function openDefaultsManager() {
    requireAuth(() => {
      defaults.clearDefaultsStatus();
      recurring.clearRecurringStatus();
      recurring.resetRecurringState();
      entryComposer.resetComposerState();
      navigateTo("categories");
    });
  }

  function closeDefaultsManager() {
    defaults.clearDefaultsStatus();
    navigateTo("dashboard");
  }

  function navigateToPage(route: "dashboard" | "transactions" | "categories") {
    if (route === "categories") {
      openDefaultsManager();
      return;
    }

    defaults.clearDefaultsStatus();
    recurring.clearRecurringStatus();
    entryComposer.closeComposer();
    navigateTo(route);
  }

  const totalTransactions =
    (data.dashboard?.counts.expenses ?? 0) +
    (data.dashboard?.counts.income ?? 0);
  const dashboardActionError = recurring.actionError ?? defaults.defaultsError;
  const dashboardSaveMessage =
    recurring.saveMessage ??
    entryComposer.saveMessage ??
    defaults.defaultsMessage;

  return (
    <div className="app-shell">
      <TopBar
        activePageRoute={activePageRoute}
        currentUser={auth.currentUser}
        isAccountOpen={isAccountOpen}
        isDefaultsBusy={defaults.isDefaultsBusy}
        onExport={() => void defaults.exportData()}
        onToggleAccount={() => {
          auth.clearAccountStatus();
          if (isAccountOpen) {
            closeAccountRoute();
          } else {
            openAccountRoute();
          }
        }}
        onToggleDefaults={
          activePageRoute === "categories" ? closeDefaultsManager : openDefaultsManager
        }
      />

      {auth.currentUser ? (
        <PageNav
          activePageRoute={activePageRoute}
          onNavigate={navigateToPage}
        />
      ) : null}

      {auth.currentUser ? (
        activePageRoute === "categories" ? (
          <DefaultsPage
            activeDefaultsTab={data.activeDefaultsTab}
            defaultsError={defaults.defaultsError}
            defaultsMessage={defaults.defaultsMessage}
            defaultsOverview={data.defaultsOverview}
            onActiveDefaultsTabChange={data.setActiveDefaultsTab}
            onAddAccount={defaults.handleAddAccount}
            onAddBill={defaults.handleAddBill}
            onAddCategory={defaults.handleAddCategory}
            onAddExpenseKind={defaults.handleAddExpenseKind}
            onAddImportantDate={defaults.handleAddImportantDate}
            onAddSubcategory={defaults.handleAddSubcategory}
            onClose={closeDefaultsManager}
            onDeleteAccount={defaults.handleDeleteAccount}
            onDeleteBill={defaults.handleDeleteBill}
            onDeleteCategory={defaults.handleDeleteCategory}
            onDeleteExpenseKind={defaults.handleDeleteExpenseKind}
            onDeleteImportantDate={defaults.handleDeleteImportantDate}
            onDeleteSubcategory={defaults.handleDeleteSubcategory}
            onEditBill={defaults.handleEditBill}
            onRenameAccount={defaults.handleRenameAccount}
            onRenameCategory={defaults.handleRenameCategory}
            onRenameExpenseKind={defaults.handleRenameExpenseKind}
            onRenameImportantDate={defaults.handleRenameImportantDate}
            onSaveNotepad={defaults.handleSaveNotepad}
            onRenameSubcategory={defaults.handleRenameSubcategory}
          />
        ) : activePageRoute === "transactions" ? (
          <TransactionsPage
            accountBreakdown={transactions.accountBreakdown}
            availableAccounts={transactions.availableAccounts}
            availableCategories={transactions.availableCategories}
            availableExpenseKinds={transactions.availableExpenseKinds}
            availableMonths={transactions.availableMonths}
            categoryBreakdown={transactions.categoryBreakdown}
            entries={transactions.filteredEntries}
            error={transactions.error}
            filters={transactions.filters}
            isLoading={transactions.isLoading}
            monthBreakdown={transactions.monthBreakdown}
            onDeleteEntry={(entry) => void entryComposer.deleteEntry(entry)}
            onEditEntry={entryComposer.editEntry}
            onFilterChange={transactions.updateFilter}
            onResetFilters={transactions.resetFilters}
          />
        ) : (
          <DashboardPage
            actionError={dashboardActionError}
            dashboard={data.dashboard}
            dashboardError={data.dashboardError}
            evenUpDraft={recurring.evenUpDraft}
            isDashboardLoading={data.isDashboardLoading}
            isEvenUpSaving={recurring.isEvenUpSaving}
            isRecurringSaving={recurring.isRecurringSaving}
            recurringDraft={recurring.recurringDraft}
            referenceData={data.referenceData}
            saveMessage={dashboardSaveMessage}
            selectedMonth={data.selectedMonth}
            totalTransactions={totalTransactions}
            onCancelEvenUp={recurring.cancelEvenUpEditor}
            onCancelRecurring={recurring.cancelRecurringEditor}
            onDeleteEvenUp={recurring.deleteEvenUpRecord}
            onDeleteRecurring={recurring.deleteRecurringRule}
            onEditEvenUp={recurring.editEvenUpRecord}
            onEditRecurring={recurring.editRecurringRule}
            onEvenUpDraftChange={recurring.updateEvenUpDraft}
            onOpenEvenUp={recurring.openEvenUpEditor}
            onOpenRecurring={recurring.openRecurringEditor}
            onRecurringDraftChange={recurring.updateRecurringDraft}
            onRunRecurring={() => void recurring.runRecurringNow()}
            onSaveEvenUp={() => void recurring.saveEvenUpRecord()}
            onSaveRecurring={() => void recurring.saveRecurringRule()}
            onSelectedMonthChange={data.setSelectedMonth}
            shiftMonth={shiftMonth}
          />
        )
      ) : (
        <section className="summary-card auth-summary">
          <div className="auth-summary-copy">
            <p className="eyebrow">Sign in required</p>
            <h2>Your dashboard is tied to your username</h2>
            <p className="auth-helper">
              Create an account or sign in to load your own entries,
              categories, and account profile.
            </p>
            <button
              className="primary-inline-button"
              onClick={() => {
                auth.setAuthMode("login");
                auth.clearAccountStatus();
                openAccountRoute();
              }}
              type="button"
            >
              Open account
            </button>
          </div>
        </section>
      )}

      {isAccountOpen ? (
        <AccountDialog
          accountError={auth.accountError}
          accountMessage={auth.accountMessage}
          authForm={auth.authForm}
          authMode={auth.authMode}
          currentUser={auth.currentUser}
          isAuthBusy={auth.isAuthBusy}
          profileForm={auth.profileForm}
          onAuthModeChange={auth.setAuthMode}
          onAuthSubmit={() => void auth.handleAuthSubmit()}
          onClose={closeAccountRoute}
          onProfileFormChange={auth.updateProfileForm}
          onSaveProfile={() => void auth.saveProfile()}
          onSignOut={() => void auth.signOut()}
          onAuthFormChange={auth.updateAuthForm}
        />
      ) : null}

      {auth.currentUser && entryComposer.visibleComposer ? (
        <EntryComposer
          availableAccounts={availableAccounts}
          availableCategories={availableCategories}
          availableCounterparties={availableCounterparties}
          availableExpenseKinds={availableExpenseKinds}
          availableSubcategories={availableSubcategories}
          closingComposer={entryComposer.closingComposer}
          draft={entryComposer.draft}
          isEditing={entryComposer.isEditing}
          isEntrySaving={entryComposer.isEntrySaving}
          saveError={entryComposer.saveError}
          visibleComposer={entryComposer.visibleComposer}
          onClose={entryComposer.closeComposer}
          onDraftChange={entryComposer.updateDraft}
          onSave={() => void entryComposer.saveEntry()}
        />
      ) : null}

      {activePageRoute === "dashboard" ? (
        <FloatingActions
          activeComposer={entryComposer.activeComposer}
          closingComposer={entryComposer.closingComposer}
          currentUserExists={Boolean(auth.currentUser)}
          onCloseComposer={entryComposer.closeComposer}
          onOpenComposer={entryComposer.openComposer}
        />
      ) : null}

      {auth.isSessionLoading ? (
        <div className="status-banner">Restoring session...</div>
      ) : null}
    </div>
  );
}
