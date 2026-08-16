import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const webSource = fileURLToPath(
  new URL("../Codebase - Pensive Web/src", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      src: webSource,
      "@pensive/web": webSource,
      "@pensive/convex": fileURLToPath(new URL("../convex", import.meta.url)),
      "@pensive/convex-api": fileURLToPath(
        new URL("../convex/_generated/api.js", import.meta.url),
      ),
      "@pensive/convex-data-model": fileURLToPath(
        new URL("../convex/_generated/dataModel.d.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup/vitest.ts"],
    environmentOptions: {
      jsdom: { url: "http://localhost" },
    },
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "test-results/coverage",
      include: ["Codebase - Pensive Web/src/**/*.{ts,tsx}", "convex/**/*.ts"],
      exclude: ["**/types/**", "**/_generated/**", "**/*.d.ts"],
    },
  },
});