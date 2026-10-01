import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import type { Env } from "./config/env";

/** Shared by main.ts and the e2e tests so both run the exact same HTTP stack. */
export function configureApp(app: INestApplication, env: Env) {
  const express = app as NestExpressApplication;
  express.set("trust proxy", env.TRUST_PROXY ? 1 : false);
  express.disable("x-powered-by"); // express.json default limit is 100kb
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: ["x-request-id", "retry-after"],
  });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  return app;
}
