import request from "supertest";
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
  // Start on a real port. Without this, supertest starts and stops the server for each request,
  // and a sign-in made in the middle of building another request closes the server under it.
  await app.listen(0);
  return { app, otp };
}

/**
 * One sign-in per account per spec file. The identifier rate limit (5 per 15 min, pinned in
 * setup-env.ts so the 429 test checks the real rule) would otherwise trip as suites grow.
 * Tokens name the person only (D-015), so a cached token sees membership changes immediately.
 */
export function signInCache(app: INestApplication, otp: CapturingOtpSender) {
  const cache = new Map<string, string>();
  return async function token(
    identifier: string,
    password = process.env.SEED_DEV_PASSWORD || "Ecclesios#2026",
    path: "login" | "admin-login" = "login",
  ): Promise<string> {
    const key = `${path}|${identifier}|${password}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const r1 = await request(app.getHttpServer())
      .post(`/api/auth/${path}`)
      .send({ identifier, password })
      .expect(200);
    const r2 = await request(app.getHttpServer())
      .post("/api/auth/verify-otp")
      .send({ challengeToken: r1.body.challengeToken, otp: otp.last() })
      .expect(200);
    const accessToken = r2.body.accessToken as string;
    cache.set(key, accessToken);
    return accessToken;
  };
}
