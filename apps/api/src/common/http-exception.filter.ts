import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ApiError } from "@ecclesios/shared";
import type { Request, Response } from "express";
import { DomainError } from "../auth/core/errors";

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "RATE_LIMITED",
};

/** Every error leaves the API in the ApiError envelope (packages/shared, todo P2). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const rawId = (req as { id?: unknown }).id; // set by pino-http genReqId
    const requestId = rawId == null ? undefined : String(rawId);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError["error"] = { code: "INTERNAL", message: "Something went wrong.", requestId };

    if (exception instanceof DomainError) {
      status = exception.status;
      body = { code: exception.code, message: exception.message, details: exception.details, requestId };
      if (exception.retryAfterSec) res.setHeader("Retry-After", String(exception.retryAfterSec));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      const message = typeof r === "string" ? r : ((r as { message?: unknown }).message ?? exception.message);
      body = {
        code: STATUS_CODES[status] ?? `HTTP_${status}`,
        message: Array.isArray(message) ? message.join("; ") : String(message),
        requestId,
      };
    } else {
      this.logger.error({ err: exception, requestId }, "Unhandled exception");
    }

    if (status >= 500 && !(exception instanceof DomainError)) {
      // never leak internals
      body = { code: body.code === "INTERNAL" ? "INTERNAL" : body.code, message: "Something went wrong.", requestId };
    }
    res.status(status).json({ error: body } satisfies ApiError);
  }
}
