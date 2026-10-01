import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { ENV, type Env, loadDotEnv, loadEnv } from "./config/env";

async function bootstrap() {
  loadDotEnv();
  loadEnv(); // fail fast with a readable message before Nest starts
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const env = app.get<Env>(ENV);
  configureApp(app, env);
  await app.listen(env.PORT);
  app.get(Logger).log(`Ecclesios API listening on http://localhost:${env.PORT}/api`);
}

bootstrap().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
