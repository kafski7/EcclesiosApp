// @ecclesios/shared — single source of API contracts (Zod) + domain rules.
// Standing rule: every API change lands here first, then in consumers.
export * from "./domain/index.js";
export * from "./enums.js";
export * from "./schemas/common.js";
export * from "./schemas/health.js";
export * from "./schemas/collections.js";
export * from "./schemas/auth.js";
