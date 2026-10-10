import { describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env";
import { Jobs, redisOptions } from "./jobs.service";

const inlineEnv = { QUEUE_DRIVER: "inline", WORKERS: true } as unknown as Env;

describe("Jobs (inline driver, D-050)", () => {
  it("runs the handler straight away, once, as the final attempt", async () => {
    const jobs = new Jobs(inlineEnv);
    const seen: unknown[] = [];
    jobs.handle("message.expand", async (data, ctx) => {
      seen.push([data.messageId, ctx]);
    });
    await jobs.add("message.expand", { messageId: "m1" });
    expect(seen).toEqual([["m1", { attempt: 1, final: true }]]);
  });

  it("logs a failing job instead of failing the caller", async () => {
    const jobs = new Jobs(inlineEnv);
    const h = vi.fn(async () => {
      throw new Error("boom");
    });
    jobs.handle("notify", h);
    await expect(
      jobs.add("notify", { type: "SYSTEM", to: "people", memberIds: [], title: "x" }),
    ).resolves.toBeUndefined();
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("refuses a second handler for the same job", () => {
    const jobs = new Jobs(inlineEnv);
    jobs.handle("notify", async () => {});
    expect(() => jobs.handle("notify", async () => {})).toThrow(/already/);
  });

  it("run() reports a missing handler", async () => {
    await expect(new Jobs(inlineEnv).run("digest.birthdays", {})).rejects.toThrow(/No handler/);
  });
});

describe("redisOptions", () => {
  it("parses host, port, credentials, db and TLS", () => {
    expect(redisOptions("redis://localhost:6379")).toMatchObject({ host: "localhost", port: 6379 });
    expect(redisOptions("rediss://u:p%40ss@cache.example:6380/2")).toMatchObject({
      host: "cache.example",
      port: 6380,
      username: "u",
      password: "p@ss",
      db: 2,
      tls: {},
    });
  });
});
