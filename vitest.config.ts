import { getViteConfig } from "astro/config";
import { configDefaults } from "vitest/config";

export default getViteConfig({
  test: {
    globalSetup: "./tests/portalSetup.ts",
    environment: "node",
    // Convex-backend-tests draaien via vitest.convex.config.ts (edge-runtime).
    exclude: [...configDefaults.exclude, "tests/convex/**"],
  }
});
