import { useEffect, useState } from "react";
import { CloseIcon } from "../../../components/icons";
import { getUserInitials } from "../utils";
import type { AuthForm, AuthMode, AuthUser, ProfileForm } from "../types";

type AccountDialogProps = {
  accountError: string | null;
  accountMessage: string | null;
  authForm: AuthForm;
  authMode: AuthMode;
  currentUser: AuthUser | null;
  isAuthBusy: boolean;
  profileForm: ProfileForm;
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthSubmit: () => void;
  onClose: () => void;
  onProfileFormChange: <K extends keyof ProfileForm>(
    field: K,
    value: ProfileForm[K],
  ) => void;
  onSaveProfile: () => void;
  onSignOut: () => void;
  onAuthFormChange: <K extends keyof AuthForm>(
    field: K,
    value: AuthForm[K],
  ) => void;
};

export function AccountDialog({
  accountError,
  accountMessage,
  authForm,
  authMode,
  currentUser,
  isAuthBusy,
  profileForm,
  onAuthModeChange,
  onAuthSubmit,
  onClose,
  onProfileFormChange,
  onSaveProfile,
  onSignOut,
  onAuthFormChange,
}: AccountDialogProps) {
  const [canCloseFromBackdrop, setCanCloseFromBackdrop] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCanCloseFromBackdrop(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <button
        className="settings-backdrop"
        onClick={() => {
          if (canCloseFromBackdrop) {
            onClose();
          }
        }}
        type="button"
      />
      <div
        className="settings-card account-card"
        onClick={(event) => event.stopPropagation()}
      >
        {currentUser ? (
          <>
            <div className="settings-header">
              <div>
                <p className="eyebrow">Account</p>
                <h3>Profile and sign-in details</h3>
              </div>
              <button className="close-button" onClick={onClose} type="button">
                <CloseIcon />
              </button>
            </div>

            {accountError ? (
              <div className="status-banner error inline">{accountError}</div>
            ) : null}
            {accountMessage ? (
              <div className="status-banner success inline">
                {accountMessage}
              </div>
            ) : null}

            <div className="account-layout">
              <div className="account-preview">
                {currentUser.profile.pictureUrl ? (
                  <img
                    alt={currentUser.profile.fullName}
                    className="avatar-preview"
                    src={currentUser.profile.pictureUrl}
                  />
                ) : (
                  <div className="avatar-fallback">
                    {getUserInitials(currentUser)}
                  </div>
                )}
                <strong>{currentUser.profile.fullName}</strong>
                <span>@{currentUser.username}</span>
              </div>

              <div className="account-form">
                <label>
                  Username
                  <input readOnly value={currentUser.username} />
                </label>
                <label>
                  Full name
                  <input
                    onChange={(event) =>
                      onProfileFormChange("fullName", event.target.value)
                    }
                    value={profileForm.fullName}
                  />
                </label>
                <label>
                  Email
                  <input
                    onChange={(event) =>
                      onProfileFormChange("email", event.target.value)
                    }
                    placeholder="name@example.com"
                    value={profileForm.email}
                  />
                </label>
                <label>
                  Age
                  <input
                    inputMode="numeric"
                    onChange={(event) =>
                      onProfileFormChange("age", event.target.value)
                    }
                    placeholder="Optional"
                    value={profileForm.age}
                  />
                </label>
                <label className="full-width">
                  Picture URL
                  <input
                    onChange={(event) =>
                      onProfileFormChange("pictureUrl", event.target.value)
                    }
                    placeholder="https://..."
                    value={profileForm.pictureUrl}
                  />
                </label>
                <label>
                  Current password
                  <input
                    onChange={(event) =>
                      onProfileFormChange("currentPassword", event.target.value)
                    }
                    placeholder="Only needed to change password"
                    type="password"
                    value={profileForm.currentPassword}
                  />
                </label>
                <label>
                  New password
                  <input
                    onChange={(event) =>
                      onProfileFormChange("newPassword", event.target.value)
                    }
                    placeholder="Leave blank to keep current"
                    type="password"
                    value={profileForm.newPassword}
                  />
                </label>
              </div>
            </div>

            <div className="composer-actions">
              <button
                className="ghost-action danger"
                onClick={onSignOut}
                type="button"
              >
                Sign out
              </button>
              <button
                className="save-action account"
                disabled={isAuthBusy}
                onClick={onSaveProfile}
                type="button"
              >
                {isAuthBusy ? "Saving..." : "Save profile"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="settings-header">
              <div>
                <p className="eyebrow">Account</p>
                <h3>{authMode === "login" ? "Sign in" : "Create account"}</h3>
              </div>
              <button className="close-button" onClick={onClose} type="button">
                <CloseIcon />
              </button>
            </div>

            <div className="segmented-control">
              <button
                className={authMode === "login" ? "active" : ""}
                onClick={() => onAuthModeChange("login")}
                type="button"
              >
                Sign in
              </button>
              <button
                className={authMode === "signup" ? "active" : ""}
                onClick={() => onAuthModeChange("signup")}
                type="button"
              >
                Create account
              </button>
            </div>

            {accountError ? (
              <div className="status-banner error inline">{accountError}</div>
            ) : null}
            {accountMessage ? (
              <div className="status-banner success inline">
                {accountMessage}
              </div>
            ) : null}

            <div className="account-form auth-form">
              <label>
                Username
                <input
                  onChange={(event) =>
                    onAuthFormChange("username", event.target.value)
                  }
                  placeholder="Choose your username"
                  value={authForm.username}
                />
              </label>
              <label>
                Password
                <input
                  onChange={(event) =>
                    onAuthFormChange("password", event.target.value)
                  }
                  placeholder="Enter your password"
                  type="password"
                  value={authForm.password}
                />
              </label>
              {authMode === "signup" ? (
                <>
                  <label>
                    Full name
                    <input
                      onChange={(event) =>
                        onAuthFormChange("fullName", event.target.value)
                      }
                      placeholder="Full name"
                      value={authForm.fullName}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      onChange={(event) =>
                        onAuthFormChange("email", event.target.value)
                      }
                      placeholder="Optional profile email"
                      value={authForm.email}
                    />
                  </label>
                  <label>
                    Age
                    <input
                      inputMode="numeric"
                      onChange={(event) =>
                        onAuthFormChange("age", event.target.value)
                      }
                      placeholder="Optional"
                      value={authForm.age}
                    />
                  </label>
                  <label className="full-width">
                    Picture URL
                    <input
                      onChange={(event) =>
                        onAuthFormChange("pictureUrl", event.target.value)
                      }
                      placeholder="https://..."
                      value={authForm.pictureUrl}
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="composer-actions">
              <button
                className="save-action account"
                disabled={isAuthBusy}
                onClick={onAuthSubmit}
                type="button"
              >
                {isAuthBusy
                  ? "Working..."
                  : authMode === "login"
                    ? "Sign in"
                    : "Create account"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
