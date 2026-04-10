import { useEffect, useState } from "react";
import {
  observeCurrentUser,
  requestJson,
  signOutCurrentUser,
} from "../../../lib/firebaseApi";
import { buildProfileForm } from "../fallbacks";
import type { AuthForm, AuthMode, AuthUser, ProfileForm } from "../types";

type UseFinanceAuthOptions = {
  onAuthenticated: () => void;
  onSignedOut: () => void;
};

export function useFinanceAuth({
  onAuthenticated,
  onSignedOut,
}: UseFinanceAuthOptions) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthForm>({
    username: "",
    password: "",
    fullName: "",
    email: "",
    age: "",
    pictureUrl: "",
  });
  const [profileForm, setProfileForm] = useState<ProfileForm>(() =>
    buildProfileForm(null),
  );
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  useEffect(() => {
    setIsSessionLoading(true);

    return observeCurrentUser((user) => {
      setCurrentUser(user);
      setProfileForm(buildProfileForm(user));
      setIsSessionLoading(false);
    });
  }, []);

  function updateAuthForm<K extends keyof AuthForm>(
    field: K,
    value: AuthForm[K],
  ) {
    setAuthForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateProfileForm<K extends keyof ProfileForm>(
    field: K,
    value: ProfileForm[K],
  ) {
    setProfileForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleAuthSubmit() {
    setIsAuthBusy(true);
    setAccountError(null);
    setAccountMessage(null);

    try {
      const path = authMode === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        authMode === "login"
          ? {
              username: authForm.username,
              password: authForm.password,
            }
          : {
              username: authForm.username,
              password: authForm.password,
              fullName: authForm.fullName,
              email: authForm.email || null,
              age: authForm.age || null,
              pictureUrl: authForm.pictureUrl || null,
            };

      const user = await requestJson<AuthUser>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCurrentUser(user);
      setProfileForm(buildProfileForm(user));
      setAccountMessage(
        authMode === "login" ? "Signed in." : "Account created.",
      );
      setAuthForm({
        username: user.username,
        password: "",
        fullName: user.profile.fullName,
        email: user.profile.email ?? "",
        age: user.profile.age === null ? "" : String(user.profile.age),
        pictureUrl: user.profile.pictureUrl ?? "",
      });
      onAuthenticated();
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Unable to continue.",
      );
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function saveProfile() {
    if (!currentUser?.username) {
      return;
    }

    setIsAuthBusy(true);
    setAccountError(null);
    setAccountMessage(null);

    try {
      const payload: Record<string, string | number | null> = {
        fullName: profileForm.fullName,
        email: profileForm.email || null,
        age: profileForm.age || null,
        pictureUrl: profileForm.pictureUrl || null,
      };

      if (profileForm.newPassword) {
        payload.currentPassword = profileForm.currentPassword;
        payload.newPassword = profileForm.newPassword;
      }

      const user = await requestJson<AuthUser>(
        "/profile",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        currentUser.username,
      );

      setCurrentUser(user);
      setProfileForm(buildProfileForm(user));
      setAccountMessage("Profile updated.");
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Unable to save profile.",
      );
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      await signOutCurrentUser();
      setCurrentUser(null);
      setProfileForm(buildProfileForm(null));
      onSignedOut();
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    }
  }

  return {
    currentUser,
    isSessionLoading,
    authMode,
    setAuthMode,
    authForm,
    updateAuthForm,
    profileForm,
    updateProfileForm,
    accountError,
    accountMessage,
    clearAccountStatus() {
      setAccountError(null);
      setAccountMessage(null);
    },
    isAuthBusy,
    handleAuthSubmit,
    saveProfile,
    signOut,
  };
}
