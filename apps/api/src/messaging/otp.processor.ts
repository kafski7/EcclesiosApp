import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { maskDestination } from "../auth/core/crypto";
import type { OtpJob } from "../jobs/job.types";
import { Jobs } from "../jobs/jobs.service";
import {
  EMAIL_GATEWAY,
  SMS_GATEWAY,
  type EmailGateway,
  type SendResult,
  type SmsGateway,
} from "./gateways";

/** Text of the code message. Short enough for one SMS part. */
export function otpText(code: string, expiresAt: Date, now = new Date()) {
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - now.getTime()) / 60_000));
  return `Your Ecclesios code is ${code}. It expires in ${minutes} min. Never share it.`;
}

/** Email when the identifier is an email address, SMS otherwise. */
export async function deliverOtp(
  job: OtpJob,
  sms: SmsGateway,
  email: EmailGateway,
): Promise<SendResult> {
  const text = otpText(job.code, new Date(job.expiresAt));
  return job.destination.includes("@")
    ? email.send({ to: job.destination, subject: "Your Ecclesios sign-in code", text })
    : sms.send(job.destination, text);
}

@Injectable()
export class OtpProcessor implements OnModuleInit {
  private readonly logger = new Logger("OTP");
  constructor(
    private readonly jobs: Jobs,
    @Inject(SMS_GATEWAY) private readonly sms: SmsGateway,
    @Inject(EMAIL_GATEWAY) private readonly email: EmailGateway,
  ) {}

  onModuleInit() {
    this.jobs.handle("otp.send", async (job, ctx) => {
      if (new Date(job.expiresAt) <= new Date()) return; // too late to be useful
      const r = await deliverOtp(job, this.sms, this.email);
      const to = maskDestination(job.destination);
      if (r.ok) return;
      if (r.permanent || ctx.final) {
        this.logger.error({ to, kind: job.kind, error: r.error }, "OTP not delivered");
        return;
      }
      throw new Error(r.error); // retried with backoff
    });
  }
}
