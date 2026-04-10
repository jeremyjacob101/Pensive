import { ExportIcon, SettingsIcon, UserIcon } from "../../../components/icons";
import type { AppPageRouteId } from "../../../router";
import type { AuthUser } from "../types";

type TopBarProps = {
  activePageRoute: AppPageRouteId;
  currentUser: AuthUser | null;
  isAccountOpen: boolean;
  isDefaultsBusy: boolean;
  onExport: () => void;
  onToggleAccount: () => void;
  onToggleDefaults: () => void;
};

export function TopBar({
  activePageRoute,
  currentUser,
  isAccountOpen,
  isDefaultsBusy,
  onExport,
  onToggleAccount,
  onToggleDefaults,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Finance system</p>
        <h1>{currentUser ? "Household finance system" : "Household finance system"}</h1>
      </div>

      <div className="topbar-actions">
        <button
          aria-label="Export"
          className="icon-button"
          disabled={!currentUser || isDefaultsBusy}
          onClick={onExport}
          type="button"
        >
          <ExportIcon />
        </button>
        {currentUser ? (
          <button
            aria-label="Manage lists and dates"
            className={`icon-button ${activePageRoute === "categories" ? "active" : ""}`}
            onClick={onToggleDefaults}
            type="button"
          >
            <SettingsIcon />
          </button>
        ) : null}
        <button
          aria-label={currentUser ? "Account" : "Sign in"}
          className={`icon-button ${isAccountOpen ? "active" : ""}`}
          onClick={onToggleAccount}
          type="button"
        >
          <UserIcon />
        </button>
      </div>
    </header>
  );
}
