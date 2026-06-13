import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      ".vercel/**",
      ".astro/**",
      "node_modules/**",
      "convex/_generated/**",
      "**/*.astro",
      "tools/**",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs"
    ]
  },
  // Basis: TS-recommended op de applicatie- + testcode. Ruis-regels bewust mild:
  // de convex-laag gebruikt overal `ctx: any` (vereist door het Convex-typemodel).
  {
    files: ["convex/**/*.ts", "src/**/*.{ts,tsx}", "tests/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-empty": "warn"
    }
  },
  // Type-aware: alleen de hoogwaarde await-bug-vanger op de Convex-backend.
  {
    files: ["convex/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error"
    }
  },
  // React hooks-regels op de frontend-islands.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  prettier
);
