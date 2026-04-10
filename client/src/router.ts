export type AppRouteId = "dashboard" | "transactions" | "categories" | "user";
export type AppPageRouteId = "dashboard" | "transactions" | "categories";

type AppRouteDefinition = {
  id: AppRouteId;
  path: string;
  kind: "page" | "overlay";
  defaultParent: AppPageRouteId;
};

export const APP_ROUTES: Record<AppRouteId, AppRouteDefinition> = {
  dashboard: {
    id: "dashboard",
    path: "/",
    kind: "page",
    defaultParent: "dashboard",
  },
  transactions: {
    id: "transactions",
    path: "/transactions",
    kind: "page",
    defaultParent: "transactions",
  },
  categories: {
    id: "categories",
    path: "/categories",
    kind: "page",
    defaultParent: "categories",
  },
  user: {
    id: "user",
    path: "/user",
    kind: "overlay",
    defaultParent: "dashboard",
  },
};

export function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function parseRoute(pathname: string): AppRouteId {
  const normalizedPathname = normalizePathname(pathname);

  const matchedRoute = Object.values(APP_ROUTES).find(
    (route) => route.path === normalizedPathname,
  );

  return matchedRoute?.id ?? "dashboard";
}

export function getRoutePath(routeId: AppRouteId) {
  return APP_ROUTES[routeId].path;
}

export function isPageRoute(routeId: AppRouteId): routeId is AppPageRouteId {
  return APP_ROUTES[routeId].kind === "page";
}

export function getDefaultParentRoute(routeId: AppRouteId): AppPageRouteId {
  return APP_ROUTES[routeId].defaultParent;
}
