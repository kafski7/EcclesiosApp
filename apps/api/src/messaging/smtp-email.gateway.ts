import { createTransport, type Transporter } from "nodemailer";
import type { EmailGateway, EmailMessage, SendResult } from "./gateways";

/** Email over any SMTP server (D-050). 5xx replies are permanent; everything else is retried. */
export class SmtpEmailGateway implements EmailGateway {
  readonly name = "smtp" as const;
  private readonly transport: Transporter;
  constructor(
    private readonly cfg: {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
      from: string;
    },
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? "" } : undefined,
      });
  }

  async send(m: EmailMessage): Promise<SendResult> {
    try {
      const info = (await this.transport.sendMail({
        from: this.cfg.from,
        to: m.to,
        subject: m.subject,
        text: m.text,
      })) as { messageId?: string };
      return { ok: true, ref: info.messageId ?? null };
    } catch (e) {
      const code = (e as { responseCode?: number }).responseCode;
      return {
        ok: false,
        permanent: typeof code === "number" && code >= 500,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
      };
    }
  }
}
