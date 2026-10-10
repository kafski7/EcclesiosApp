import { Logger } from "@nestjs/common";
import { maskDestination } from "../auth/core/crypto";

/** What a gateway says about one message. `permanent` = retrying won't help (bad number, rejected). */
export type SendResult =
  | { ok: true; ref: string | null }
  | { ok: false; permanent: boolean; error: string };

export interface SmsGateway {
  readonly name: "console" | "hubtel";
  send(to: string, text: string): Promise<SendResult>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export interface EmailGateway {
  readonly name: "console" | "smtp";
  send(m: EmailMessage): Promise<SendResult>;
}

export const SMS_GATEWAY = Symbol("SMS_GATEWAY");
export const EMAIL_GATEWAY = Symbol("EMAIL_GATEWAY");

/**
 * Development stand-in: logs instead of sending. The text (OTP codes included) is logged only
 * outside production, as the console OTP sender did before Phase 7 — and production refuses
 * SMS_PROVIDER=console at boot (env.ts).
 */
export class ConsoleSmsGateway implements SmsGateway {
  readonly name = "console" as const;
  private readonly logger = new Logger("SMS");
  constructor(private readonly showText: boolean) {}
  async send(to: string, text: string): Promise<SendResult> {
    const masked = maskDestination(to);
    if (this.showText) this.logger.log(`SMS to ${masked}: ${text}`);
    else this.logger.log({ to: masked, chars: text.length }, "SMS (console gateway, not sent)");
    return { ok: true, ref: null };
  }
}

export class ConsoleEmailGateway implements EmailGateway {
  readonly name = "console" as const;
  private readonly logger = new Logger("Email");
  constructor(private readonly showText: boolean) {}
  async send(m: EmailMessage): Promise<SendResult> {
    const masked = maskDestination(m.to);
    if (this.showText) this.logger.log(`Email to ${masked} — ${m.subject}\n${m.text}`);
    else this.logger.log({ to: masked, subject: m.subject }, "email (console gateway, not sent)");
    return { ok: true, ref: null };
  }
}

/** HTTP status → is it worth retrying? 408/429/5xx and network errors are; other 4xx are not. */
export const isTransientStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;
