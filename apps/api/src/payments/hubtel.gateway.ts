import type { GatewayStatus, InitiateInput, PaymentGateway } from "./gateway";
import { GatewayError } from "./gateway";

/**
 * Hubtel Online Checkout (D-036).
 *  - Initiate: POST https://payproxyapi.hubtel.com/items/initiate (HTTP Basic: client id + secret)
 *    → data.checkoutUrl, data.checkoutId.
 *  - Status:   GET https://api-txnstatus.hubtel.com/transactions/{merchantAccount}/status?clientReference=…
 *    (Basic auth; Hubtel also requires the server's IP to be whitelisted) → data.status "Paid" | "Unpaid" | …
 * Verify these against Hubtel's current documentation and your sandbox before going live.
 */
export class HubtelGateway implements PaymentGateway {
  readonly name = "hubtel" as const;
  constructor(
    private readonly cfg: { clientId: string; clientSecret: string; merchantAccount: string },
    private readonly http: typeof fetch = fetch,
  ) {}

  private get auth() {
    return `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64")}`;
  }

  async initiate(i: InitiateInput) {
    const res = await this.http("https://payproxyapi.hubtel.com/items/initiate", {
      method: "POST",
      headers: {
        authorization: this.auth,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        totalAmount: i.amountMinor / 100,
        description: i.description.slice(0, 100),
        callbackUrl: i.callbackUrl,
        returnUrl: i.returnUrl,
        cancellationUrl: i.cancelUrl,
        merchantAccountNumber: this.cfg.merchantAccount,
        clientReference: i.clientReference,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      data?: { checkoutUrl?: string; checkoutId?: string };
    } | null;
    if (!res.ok || !body?.data?.checkoutUrl)
      throw new GatewayError(`Hubtel initiate failed (${res.status})`);
    return {
      checkoutUrl: body.data.checkoutUrl,
      gatewayRef: body.data.checkoutId ?? null,
      raw: body,
    };
  }

  async status(clientReference: string): Promise<GatewayStatus> {
    const url = `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(this.cfg.merchantAccount)}/status?clientReference=${encodeURIComponent(clientReference)}`;
    const res = await this.http(url, {
      headers: { authorization: this.auth, accept: "application/json" },
    });
    const body = (await res.json().catch(() => null)) as {
      data?: {
        status?: string;
        amount?: number;
        transactionId?: string;
        externalTransactionId?: string;
      };
    } | null;
    if (!res.ok || !body?.data) throw new GatewayError(`Hubtel status failed (${res.status})`);
    return parseHubtelStatus(body.data, body);
  }
}

/** Hubtel status → ours. Exported for tests. */
export function parseHubtelStatus(
  d: { status?: string; amount?: number; transactionId?: string },
  raw: unknown,
): GatewayStatus {
  const s = (d.status ?? "").toLowerCase();
  const state =
    s === "paid" || s === "success" || s === "successful"
      ? "PAID"
      : s === "unpaid" || s === "pending" || s === ""
        ? "PENDING"
        : "FAILED";
  return {
    state,
    amountMinor: typeof d.amount === "number" ? Math.round(d.amount * 100) : null,
    gatewayRef: d.transactionId ?? null,
    raw,
  };
}
