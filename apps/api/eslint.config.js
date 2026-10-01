const base = require("@ecclesios/config/eslint/base");

module.exports = [
  ...base,
  {
    // NestJS resolves constructor dependencies from emitted decorator metadata.
    // Turning a class import into `import type` erases it and silently breaks DI,
    // so this rule must stay off in the API.
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },
];
