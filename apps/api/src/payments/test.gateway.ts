import type { GatewayStatus, InitiateInput, PaymentGateway } from "./gateway";

/**
 * Development / e2e gateway (D-036): the "checkout" is a page in our own web app with a
 * Pay (test) button. Never allowed in production (env check).
 */
export class TestGateway implements PaymentGateway {
  readonly name = "test" as const;
  private readonly paid = new Map<string, { amountMinor: number; failed: boolean }>();
  constructor(private readonly webUrl: string) {}

  async initiate(i: InitiateInput) {
    return { checkoutUrl: `${this.webUrl}/books/checkout/test?ref=${encodeURIComponent(i.clientReference)}`, gatewayRef: null, raw: { test: true } };
  }

  /** Called by the test checkout page. */
  settle(clientReference: string, amountMinor: number, failed = false) {
    this.paid.set(clientReference, { amountMinor, failed });
  }

  async status(clientReference: string): Promise<GatewayStatus> {
    const p = this.paid.get(clientReference);
    if (!p) return { state: "PENDING", amountMinor: null, gatewayRef: null, raw: null };
    return { state: p.failed ? "FAILED" : "PAID", amountMinor: p.amountMinor, gatewayRef: `TEST-${clientReference.slice(0, 8)}`, raw: { test: true } };
  }
}
