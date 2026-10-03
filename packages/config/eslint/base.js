// Shared flat ESLint config (ESLint 9)
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");

module.exports = tseslint.config(
  // eslint.config.js files are plain CJS consumed by ESLint itself, not app code.
  {
    ignores: [
      "dist/**",
      "coverage/**",
      ".turbo/**",
      "node_modules/**",
      "drizzle/**",
      "eslint.config.js",
      "eslint.config.cjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
);
