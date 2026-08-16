// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import type { ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import { Breakdown } from "../../../Codebase - Pensive Web/src/pages/Breakdown";
import { Expenses } from "../../../Codebase - Pensive Web/src/pages/Expenses";
import { Incomings } from "../../../Codebase - Pensive Web/src/pages/Incomings";
import { Notepad } from "../../../Codebase - Pensive Web/src/pages/Notepad";
import { Options } from "../../../Codebase - Pensive Web/src/pages/Options";
import { Recurrings } from "../../../Codebase - Pensive Web/src/pages/Recurrings";
import { Tracking } from "../../../Codebase - Pensive Web/src/pages/Tracking";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
  useQuery: () => undefined,
}));

const outletContext = {
  expenseSearchQuery: "",
  expenseSelectedSearchFields: ["expense"],
  incomingSearchQuery: "",
  incomingSelectedSearchFields: ["incoming"],
  setVisibleExpenseIds: vi.fn(),
  setVisibleExpenseCategories: vi.fn(),
  setVisibleIncomingIds: vi.fn(),
  setVisibleIncomingTypes: vi.fn(),
};

function renderPage(Page: ComponentType) {
  return render(
    <MemoryRouter initialEntries={["/page"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="*" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("web feature page smoke coverage", () => {
  it.each([
    ["expenses", Expenses],
    ["incomings", Incomings],
    ["breakdown", Breakdown],
    ["recurrings", Recurrings],
    ["tracking", Tracking],
    ["notepad", Notepad],
    ["options", Options],
  ] as const)("mounts the %s feature in its loading/empty state", (_, Page) => {
    const view = renderPage(Page);
    expect(view.container.firstElementChild).toBeTruthy();
  });
});
