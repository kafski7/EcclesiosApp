import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { CmsModule } from "./cms/cms.module";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import { ConfigModule } from "./config/config.module";
import { ENV, type Env } from "./config/env";
import { DbModule } from "./db/db.module";
import { HealthModule } from "./health/health.module";
import { HymnalModule } from "./hymnal/hymnal.module";
import { MediaModule } from "./media/media.module";
import { RbacModule } from "./rbac/rbac.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { RegistrationModule } from "./registration/registration.module";
import { ScopeGuard } from "./rbac/scope.guard";
import { PlatformModule } from "./platform/platform.module";
import { PlatformRoleGuard } from "./platform/platform-role";
import { SocialModule } from "./social/social.module";
import { SubscriptionGuard } from "./subscriptions/subscription.guard";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req, res) => {
            const incoming = req.headers["x-request-id"];
            const id =
              typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming)
                ? incoming
                : randomUUID();
            res.setHeader("x-request-id", id);
            return id;
          },
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.body.password",
              "req.body.email",
              "req.body.telephone",
              "req.body.dateOfBirth",
              "req.body.newPassword",
              "req.body.otp",
              "req.body.refreshToken",
              "req.body.tempToken",
              "req.body.challengeToken",
            ],
            censor: "[redacted]",
          },
          transport:
            env.NODE_ENV === "development"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
          autoLogging: { ignore: (req) => req.url === "/api/health" },
        },
      }),
    }),
    DbModule,
    AuditModule,
    AuthModule,
    RbacModule,
    MembershipsModule,
    RegistrationModule,
    HealthModule,
    CmsModule,
    SocialModule,
    SubscriptionsModule,
    PlatformModule,
    MediaModule,
    HymnalModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: authenticate first, then check hierarchy scope…
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    // …then the platform-role check, then the subscription gate (D-020).
    { provide: APP_GUARD, useClass: PlatformRoleGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
  ],
})
export class AppModule {}
