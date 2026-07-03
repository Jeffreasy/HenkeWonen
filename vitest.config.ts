import { getViteConfig } from "astro/config";
import { configDefaults } from "vitest/config";

export default getViteConfig({
  test: {
    globalSetup: "./tests/portalSetup.ts",
    environment: "node",
    // Convex-backend-tests draaien via vitest.convex.config.ts (edge-runtime).
    // .claude/worktrees bevat losse git-worktrees van agent-sessies; hun testkopieën
    // lezen bronbestanden via cwd en falen dan onterecht tegen deze checkout.
    exclude: [...configDefaults.exclude, "tests/convex/**", "**/.claude/**"],
  }
});
