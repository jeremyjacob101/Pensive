import type { AppPageRouteId } from "../../../router";

type PageNavProps = {
  activePageRoute: AppPageRouteId;
  onNavigate: (route: AppPageRouteId) => void;
};

const pageLabels: Record<AppPageRouteId, string> = {
  dashboard: "Dashboard",
  transactions: "Transactions",
  categories: "Lists",
};

export function PageNav({ activePageRoute, onNavigate }: PageNavProps) {
  return (
    <nav aria-label="Finance pages" className="page-nav">
      {(Object.keys(pageLabels) as AppPageRouteId[]).map((route) => (
        <button
          className={activePageRoute === route ? "active" : ""}
          key={route}
          onClick={() => onNavigate(route)}
          type="button"
        >
          {pageLabels[route]}
        </button>
      ))}
    </nav>
  );
}
