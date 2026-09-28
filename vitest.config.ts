import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
export default defineConfig({
  resolve: {
    alias: {
      // alias for the core package of the buckwea project
      "@buckwea/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
