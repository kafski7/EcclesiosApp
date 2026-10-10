import { Inject, Injectable, Logger } from "@nestjs/common";
import { maskDestination } from "./core/crypto";
import type { OtpMessage, OtpSender } from "./core/types";
import { ENV, type Env } from "../config/env";
import { Jobs } from "../jobs/jobs.service";
import { deliverOtp } from "../messaging/otp.processor";
import {
  EMAIL_GATEWAY,
  SMS_GATEWAY,
  type EmailGateway,
  type SmsGateway,
} from "../messaging/gateways";

export const OTP_SENDER = Symbol("OTP_SENDER");

/**
 * OTP delivery through the SMS/email gateways (Phase 7, D-050) — replaces the console sender.
 * The request only queues an `otp.send` job (removed from Redis as soon as it's done). If the
 * queue itself is unreachable, the code is sent directly rather than leaving the person unable
 * to sign in; that fallback is logged.
 */
@Injectable()
export class QueuedOtpSender implements OtpSender {
  private readonly logger = new Logger("OTP");
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jobs: Jobs,
    @Inject(SMS_GATEWAY) private readonly sms: SmsGateway,
    @Inject(EMAIL_GATEWAY) private readonly email: EmailGateway,
  ) {}

  /** "console" while both gateways only log (the sign-in screen then says where to look). */
  get channel(): OtpSender["channel"] {
    if (this.env.SMS_PROVIDER === "console" && this.env.EMAIL_PROVIDER === "console") return "console";
    return this.env.SMS_PROVIDER === "console" ? "email" : "sms";
  }

  async send(m: OtpMessage) {
    const job = {
      kind: m.kind,
      accountId: m.accountId,
      destination: m.destination,
      code: m.code,
      expiresAt: m.expiresAt.toISOString(),
    };
    try {
      await this.jobs.add("otp.send", job);
    } catch (err) {
      this.logger.warn(
        { err, to: maskDestination(m.destination) },
        "OTP queue unavailable — sending directly",
      );
      const r = await deliverOtp(job, this.sms, this.email);
      if (!r.ok) this.logger.error({ to: maskDestination(m.destination), error: r.error }, "OTP not delivered");
    }
  }
}
