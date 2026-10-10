import type { SendResult, SmsGateway } from "./gateways";
import { isTransientStatus } from "./gateways";

/**
 * Hubtel SMS (D-050): POST {url} with HTTP Basic (client id + secret) and
 * `{ From, To, Content }`; a 2xx reply carries `status` (0 = accepted) and `messageId`.
 * Sender IDs must be approved in the Hubtel portal first. Verify against Hubtel's current
 * documentation and a test send before going live.
 */
export class HubtelSmsGateway implements SmsGateway {
  readonly name = "hubtel" as const;
  constructor(
    private readonly cfg: { clientId: string; clientSecret: string; senderId: string; url: string },
    private readonly http: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  async send(to: string, text: string): Promise<SendResult> {
    let res: Response;
    try {
      res = await this.http(this.cfg.url, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64")}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ From: this.cfg.senderId, To: to, Content: text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      return { ok: false, permanent: false, error: `Hubtel unreachable: ${errText(e)}` };
    }
    const body = (await res.json().catch(() => null)) as {
      status?: number | string;
      messageId?: string;
      MessageId?: string;
      statusDescription?: string;
      message?: string;
    } | null;
    if (!res.ok)
      return {
        ok: false,
        permanent: !isTransientStatus(res.status),
        error: `Hubtel ${res.status}: ${body?.statusDescription ?? body?.message ?? res.statusText}`.slice(0, 300),
      };
    const status = body?.status;
    if (status !== undefined && Number(status) !== 0)
      return {
        ok: false,
        permanent: true,
        error: `Hubtel status ${status}: ${body?.statusDescription ?? "rejected"}`.slice(0, 300),
      };
    return { ok: true, ref: body?.messageId ?? body?.MessageId ?? null };
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
