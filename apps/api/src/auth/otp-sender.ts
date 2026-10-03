import { Inject, Injectable, Logger } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { maskDestination } from "./core/crypto";
import type { OtpMessage, OtpSender } from "./core/types";

export const OTP_SENDER = Symbol("OTP_SENDER");

/**
 * functionality §2: "OTP is generated and sent (logged to console for now)".
 * The code itself is logged only outside production. Replaced by the SMS/email
 * gateway in Phase 7 (same interface, BullMQ-backed).
 */
@Injectable()
export class ConsoleOtpSender implements OtpSender {
  readonly channel = "console" as const;
  private readonly logger = new Logger("OTP");
  constructor(@Inject(ENV) private readonly env: Env) {}

  async send(m: OtpMessage) {
    const to = maskDestination(m.destination);
    if (this.env.NODE_ENV === "production") {
      this.logger.warn(
        { to, kind: m.kind },
        "OTP generated but no gateway is configured (Phase 7)",
      );
      return;
    }
    this.logger.log({ to, kind: m.kind, accountId: m.accountId }, `OTP for ${to}: ${m.code}`);
  }
}
