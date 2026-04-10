import { useCallback, useEffect, useState } from "react";
import {
  getDefaultParentRoute,
  getRoutePath,
  isPageRoute,
  parseRoute,
  type AppPageRouteId,
  type AppRouteId,
} from "../../../router";

export function useFinanceRouting() {
  const initialRoute = parseRoute(window.location.pathname);
  const [routeId, setRouteId] = useState<AppRouteId>(initialRoute);
  const [lastPageRoute, setLastPageRoute] = useState<AppPageRouteId>(
    getDefaultParentRoute(initialRoute),
  );

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = parseRoute(window.location.pathname);
      setRouteId(nextRoute);
      if (isPageRoute(nextRoute)) {
        setLastPageRoute(nextRoute);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = useCallback(
    (route: AppRouteId, options?: { replace?: boolean }) => {
      const nextPath = getRoutePath(route);
      const currentPath = window.location.pathname;
      const shouldReplace = options?.replace ?? false;

      if (currentPath !== nextPath) {
        window.history[shouldReplace ? "replaceState" : "pushState"](
          {},
          "",
          nextPath,
        );
      } else if (shouldReplace) {
        window.history.replaceState({}, "", nextPath);
      }

      setRouteId(route);
      if (isPageRoute(route)) {
        setLastPageRoute(route);
      }
    },
    [],
  );

  const openAccountRoute = useCallback(() => {
    navigateTo("user");
  }, [navigateTo]);

  const closeAccountRoute = useCallback(() => {
    navigateTo(lastPageRoute);
  }, [lastPageRoute, navigateTo]);

  return {
    routeId,
    activePageRoute: isPageRoute(routeId) ? routeId : lastPageRoute,
    isAccountOpen: routeId === "user",
    navigateTo,
    openAccountRoute,
    closeAccountRoute,
  };
}
