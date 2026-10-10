import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { loadDotEnv, loadEnv } from "./config/env";

/**
 * Background workers only, no HTTP (D-050). Production: run this as its own process
 * (`pnpm --filter @ecclesios/api worker`) and set WORKERS=0 on the API processes.
 */
async function bootstrap() {
  loadDotEnv();
  process.env.WORKERS = "1";
  const env = loadEnv();
  if (env.QUEUE_DRIVER !== "bullmq") throw new Error("The worker needs QUEUE_DRIVER=bullmq.");
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log("Ecclesios workers running");
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
