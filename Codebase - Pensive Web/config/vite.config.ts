import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const webRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: webRoot,
  envDir: repoRoot,
  plugins: [react()],
  resolve: {
    alias: {
      "@pensive/convex-api": fileURLToPath(
        new URL("../../convex/_generated/api.js", import.meta.url),
      ),
      "@pensive/convex-data-model": fileURLToPath(
        new URL("../../convex/_generated/dataModel.d.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 1111,
  },
});
