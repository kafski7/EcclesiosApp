import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { ENV, type Env } from "../src/config/env";
import type { OtpMessage, OtpSender } from "../src/auth/core/types";
import { OTP_SENDER } from "../src/auth/otp-sender";

/** Captures OTPs instead of logging them, so tests can complete the flow. */
export class CapturingOtpSender implements OtpSender {
  readonly channel = "console" as const;
  readonly sent: OtpMessage[] = [];
  async send(m: OtpMessage) {
    this.sent.push(m);
  }
  last() {
    const m = this.sent.at(-1);
    if (!m) throw new Error("no OTP sent");
    return m.code;
  }
}

export async function createTestApp(): Promise<{ app: INestApplication; otp: CapturingOtpSender }> {
  const otp = new CapturingOtpSender();
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OTP_SENDER)
    .useValue(otp)
    .compile();
  const app = mod.createNestApplication({ logger: false });
  configureApp(app, app.get<Env>(ENV));
  await app.init();
  return { app, otp };
}
