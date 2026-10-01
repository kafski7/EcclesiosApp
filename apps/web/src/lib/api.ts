import { ApiErrorSchema } from "@ecclesios/shared";
import type { ZodType } from "zod";

/** Error carrying the API envelope's stable code (functionality §2.3) — UIs switch on `code`, never on `message`. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current access token, if signed in. */
  getToken?: () => string | null;
  fetch?: typeof fetch;
}

/**
 * Typed JSON client. Every response is parsed with a Zod schema from @ecclesios/shared,
 * so a contract drift fails loudly here instead of deep inside a component.
 */
export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? fetch;

  async function request<T>(method: string, path: string, schema: ZodType<T> | null, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    const token = opts.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await doFetch(`${opts.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiClientError(0, "NETWORK_ERROR", "Can't reach Ecclesios. Check your connection.");
    }

    const text = await res.text();
    const json: unknown = text ? safeJson(text) : undefined;

    if (!res.ok) {
      const env = ApiErrorSchema.safeParse(json);
      if (env.success) {
        const e = env.data.error;
        throw new ApiClientError(res.status, e.code, e.message, e.details, e.requestId);
      }
      throw new ApiClientError(res.status, `HTTP_${res.status}`, "Something went wrong. Please try again.");
    }

    if (schema === null) return undefined as T;
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiClientError(res.status, "CONTRACT_MISMATCH", "Unexpected response from the server.", parsed.error.issues);
    }
    return parsed.data;
  }

  return {
    get: <T>(path: string, schema: ZodType<T>) => request("GET", path, schema),
    post: <T>(path: string, body: unknown, schema: ZodType<T>) => request("POST", path, schema, body),
    postVoid: (path: string, body: unknown) => request<void>("POST", path, null, body),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;
