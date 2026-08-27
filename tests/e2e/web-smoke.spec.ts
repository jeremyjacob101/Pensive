import { expect, test } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("web unauthenticated shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("renders only the login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Pensive" })).toBeVisible();
    await expect(page.getByPlaceholder("Username")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Need an account? Sign up" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Create Account" }),
    ).toHaveCount(0);
  });

  test("does not submit an empty credential form", async ({ page }) => {
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByPlaceholder("Username")).toBeFocused();
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("has no WCAG automated violations on the public entry point", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("does not introduce horizontal overflow on the mobile viewport", async ({
    page,
  }) => {
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});