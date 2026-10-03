import { type PipeTransform } from "@nestjs/common";
import type { ZodTypeAny, z } from "zod";
import { DomainError } from "../auth/core/errors";

/**
 * Validates a body/param/query against a packages/shared schema.
 * Usage: @Body(new ZodPipe(LoginRequestSchema)) body: LoginRequest
 */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}
  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value);
    if (r.success) return r.data;
    throw new DomainError(
      400,
      "VALIDATION_FAILED",
      "Some fields are missing or invalid.",
      r.error.flatten(),
    );
  }
}
