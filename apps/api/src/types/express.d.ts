import type { Principal } from "@ecclesios/shared";

declare module "express-serve-static-core" {
  interface Request {
    /** Set by JwtAuthGuard on authenticated routes. */
    principal?: Principal;
  }
}

// Module marker: without an export this .d.ts is treated as a script and the
// declare-module block becomes an ambient declaration instead of an augmentation.
export {};
