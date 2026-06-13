import { defineConfig } from "vitest/config";

// Aparte config voor Convex-backend-tests (convex-test draait functies echt, in
// de edge-runtime). Bewust GEEN astro getViteConfig/portalSetup hier: die spinnen
// een Astro-server op die deze tests niet nodig hebben.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["tests/convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } }
  }
});
