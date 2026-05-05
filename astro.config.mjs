import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  devToolbar: {
    enabled: false
  },
  integrations: [react()],
  vite: {
    ssr: {
      noExternal: ["convex"]
    }
  }
});
