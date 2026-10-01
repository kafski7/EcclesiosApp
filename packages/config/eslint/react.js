const base = require("./base");
const reactHooks = require("eslint-plugin-react-hooks");
const globals = require("globals");

module.exports = [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
];
