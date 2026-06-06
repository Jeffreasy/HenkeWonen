import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    globalSetup: "./tests/portalSetup.ts",
    environment: "node",
  }
});
