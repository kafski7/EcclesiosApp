import { HealthResponseSchema } from "@ecclesios/shared";
import { describe, expect, it } from "vitest";
import { ApiClientError, createApiClient } from "./api";

const respond = (status: number, body: unknown) =>
  (async () =>
    new Response(body === undefined ? "" : JSON.stringify(body), {
      status,
    })) as unknown as typeof fetch;

const healthy = {
  status: "ok",
  service: "ecclesios-api",
  checks: { database: "up" },
  time: "2026-10-01T10:00:00.000Z",
};

describe("api client", () => {
  it("parses a valid response with the shared schema", async () => {
    const api = createApiClient({ baseUrl: "http://x/api", fetch: respond(200, healthy) });
    await expect(api.get("/health", HealthResponseSchema)).resolves.toMatchObject({ status: "ok" });
  });

  it("surfaces the API error envelope code", async () => {
    const api = createApiClient({
      baseUrl: "http://x/api",
      fetch: respond(401, {
        error: { code: "INVALID_CREDENTIALS", message: "Nope", requestId: "r1" },
      }),
    });
    const err = await api.get("/health", HealthResponseSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS", requestId: "r1" });
  });

  it("flags contract drift", async () => {
    const api = createApiClient({
      baseUrl: "http://x/api",
      fetch: respond(200, { status: "weird" }),
    });
    await expect(api.get("/health", HealthResponseSchema)).rejects.toMatchObject({
      code: "CONTRACT_MISMATCH",
    });
  });

  it("reports network failures", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "http://x/api", fetch: failing });
    await expect(api.get("/health", HealthResponseSchema)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("sends the bearer token when signed in", async () => {
    let auth: string | null = null;
    const spy = (async (_url: string, init?: RequestInit) => {
      auth = (init?.headers as Record<string, string>).authorization ?? null;
      return new Response(JSON.stringify(healthy), { status: 200 });
    }) as unknown as typeof fetch;
    const api = createApiClient({ baseUrl: "http://x/api", fetch: spy, getToken: () => "abc" });
    await api.get("/health", HealthResponseSchema);
    expect(auth).toBe("Bearer abc");
  });
});
