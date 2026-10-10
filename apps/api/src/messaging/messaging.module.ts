import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import {
  ConsoleEmailGateway,
  ConsoleSmsGateway,
  EMAIL_GATEWAY,
  SMS_GATEWAY,
  type EmailGateway,
  type SmsGateway,
} from "./gateways";
import { HubtelSmsGateway } from "./hubtel-sms.gateway";
import { OtpProcessor } from "./otp.processor";
import { SmtpEmailGateway } from "./smtp-email.gateway";

/** SMS and email gateways (D-050), plus OTP delivery. Global: Messages and auth both send. */
@Global()
@Module({
  providers: [
    {
      provide: SMS_GATEWAY,
      inject: [ENV],
      useFactory: (env: Env): SmsGateway =>
        env.SMS_PROVIDER === "hubtel"
          ? new HubtelSmsGateway({
              clientId: env.HUBTEL_SMS_CLIENT_ID!,
              clientSecret: env.HUBTEL_SMS_CLIENT_SECRET!,
              senderId: env.SMS_SENDER_ID,
              url: env.HUBTEL_SMS_URL,
            })
          : new ConsoleSmsGateway(env.NODE_ENV !== "production"),
    },
    {
      provide: EMAIL_GATEWAY,
      inject: [ENV],
      useFactory: (env: Env): EmailGateway =>
        env.EMAIL_PROVIDER === "smtp"
          ? new SmtpEmailGateway({
              host: env.SMTP_HOST!,
              port: env.SMTP_PORT,
              secure: env.SMTP_SECURE,
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
              from: env.EMAIL_FROM,
            })
          : new ConsoleEmailGateway(env.NODE_ENV !== "production"),
    },
    OtpProcessor,
  ],
  exports: [SMS_GATEWAY, EMAIL_GATEWAY],
})
export class MessagingModule {}
