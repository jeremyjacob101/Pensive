type SignInFlow = "signIn" | "signUp";

type SignInPasswordInput = {
  email: string;
  password: string;
  flow: SignInFlow;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type RedirectLocation = {
  pathname?: string;
  search?: string;
  hash?: string;
};

export type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  signInPassword: (input: SignInPasswordInput) => Promise<void>;
  signOut: () => Promise<void>;
};
