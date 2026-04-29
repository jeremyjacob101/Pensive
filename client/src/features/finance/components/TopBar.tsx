import { useRef } from "react";
import {
  ExportIcon,
  ImportIcon,
  SettingsIcon,
  UserIcon,
} from "../../../components/icons";
import type { AppPageRouteId } from "../../../router";
import type { AuthUser } from "../types";

type TopBarProps = {
  activePageRoute: AppPageRouteId;
  currentUser: AuthUser | null;
  isAccountOpen: boolean;
  isDefaultsBusy: boolean;
  onExport: () => void;
  onImport: (file: File) => void;
  onToggleAccount: () => void;
  onToggleDefaults: () => void;
};

export function TopBar({
  activePageRoute,
  currentUser,
  isAccountOpen,
  isDefaultsBusy,
  onExport,
  onImport,
  onToggleAccount,
  onToggleDefaults,
}: TopBarProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Finance system</p>
        <h1>
          {currentUser
            ? "Household finance system"
            : "Household finance system"}
        </h1>
      </div>

      <div className="topbar-actions">
        <input
          ref={importInputRef}
          accept="application/json,.json"
          className="hidden-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";

            if (file) {
              onImport(file);
            }
          }}
          type="file"
        />
        <button
          aria-label="Import"
          className="icon-button"
          disabled={!currentUser || isDefaultsBusy}
          onClick={() => importInputRef.current?.click()}
          type="button"
        >
          <ImportIcon />
        </button>
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
