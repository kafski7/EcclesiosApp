import { describe, expect, it } from "vitest";
import { HubtelSmsGateway } from "./hubtel-sms.gateway";

const cfg = { clientId: "id", clientSecret: "secret", senderId: "Ecclesios", url: "https://sms.test/send" };
const reply = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("Hubtel SMS gateway (D-050)", () => {
  it("posts From/To/Content with Basic auth", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const http = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ status: 0, messageId: "m-1" }), { status: 201 });
    }) as unknown as typeof fetch;
    const r = await new HubtelSmsGateway(cfg, http).send("+233200000501", "Hello");
    expect(r).toEqual({ ok: true, ref: "m-1" });
    expect(seen!.url).toBe("https://sms.test/send");
    expect((seen!.init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from("id:secret").toString("base64")}`,
    );
    expect(JSON.parse(String(seen!.init.body))).toEqual({
      From: "Ecclesios",
      To: "+233200000501",
      Content: "Hello",
    });
  });

  it("4xx and a non-zero status are permanent; 5xx, 429 and network errors are retried", async () => {
    expect(await new HubtelSmsGateway(cfg, reply(400, { message: "bad" })).send("x", "y")).toMatchObject({
      ok: false,
      permanent: true,
    });
    expect(await new HubtelSmsGateway(cfg, reply(200, { status: 3 })).send("x", "y")).toMatchObject({
      ok: false,
      permanent: true,
    });
    expect(await new HubtelSmsGateway(cfg, reply(503, {})).send("x", "y")).toMatchObject({
      ok: false,
      permanent: false,
    });
    expect(await new HubtelSmsGateway(cfg, reply(429, {})).send("x", "y")).toMatchObject({
      ok: false,
      permanent: false,
    });
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await new HubtelSmsGateway(cfg, down).send("x", "y")).toMatchObject({
      ok: false,
      permanent: false,
    });
  });
});
