import { describe, expect, it } from "vitest";
import { HubtelGateway, parseHubtelStatus } from "./hubtel.gateway";

describe("Hubtel gateway (D-036)", () => {
  it("maps statuses and amounts", () => {
    expect(
      parseHubtelStatus({ status: "Paid", amount: 25.5, transactionId: "T1" }, null),
    ).toMatchObject({ state: "PAID", amountMinor: 2550, gatewayRef: "T1" });
    expect(parseHubtelStatus({ status: "Unpaid" }, null).state).toBe("PENDING");
    expect(parseHubtelStatus({ status: "Refunded" }, null).state).toBe("FAILED");
  });

  it("initiates with Basic auth, cedis and our reference", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(
        JSON.stringify({
          responseCode: "0000",
          data: { checkoutUrl: "https://pay.hubtel.com/abc", checkoutId: "abc" },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const g = new HubtelGateway(
      { clientId: "id", clientSecret: "secret", merchantAccount: "2010000" },
      fake,
    );
    const r = await g.initiate({
      clientReference: "ref123",
      amountMinor: 2500,
      description: "Book",
      callbackUrl: "https://api/cb",
      returnUrl: "https://web/r",
      cancelUrl: "https://web/c",
    });
    expect(r.checkoutUrl).toBe("https://pay.hubtel.com/abc");
    expect(sent!.url).toBe("https://payproxyapi.hubtel.com/items/initiate");
    const body = JSON.parse(String(sent!.init.body));
    expect(body).toMatchObject({
      totalAmount: 25,
      clientReference: "ref123",
      merchantAccountNumber: "2010000",
    });
    expect((sent!.init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from("id:secret").toString("base64")}`,
    );
  });
});
