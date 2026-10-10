/**
 * Payment gateways (D-036). The API never trusts the browser or a callback body: an order becomes
 * PAID only after `status()` asks the gateway directly.
 */
export interface InitiateInput {
  clientReference: string;
  amountMinor: number;
  description: string;
  callbackUrl: string;
  returnUrl: string;
  cancelUrl: string;
}

export type GatewayStatus = {
  state: "PAID" | "PENDING" | "FAILED";
  amountMinor: number | null;
  gatewayRef: string | null;
  raw: unknown;
};

export interface PaymentGateway {
  readonly name: "test" | "hubtel";
  initiate(
    i: InitiateInput,
  ): Promise<{ checkoutUrl: string; gatewayRef: string | null; raw: unknown }>;
  status(clientReference: string): Promise<GatewayStatus>;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export class GatewayError extends Error {}
