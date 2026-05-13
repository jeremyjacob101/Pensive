import { useNavigate, useOutletContext } from "react-router-dom";
import type { AppLayoutContext } from "./AppLayout";
import type { MenuItemKey } from "../types/ui";
import { AppWorkspace } from "./AppWorkspace";
import { useAuth } from "../context/useAuth";

export function AppSectionPage({ activeTab }: { activeTab: MenuItemKey }) {
  const { isDark, onToggleTheme } = useOutletContext<AppLayoutContext>();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AppWorkspace
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      activeTab={activeTab}
      onSelectTab={(tab) => navigate(`/app/${tab}`)}
      onSignOut={() => {
        void signOut().then(() => navigate("/login", { replace: true }));
      }}
    />
  );
}