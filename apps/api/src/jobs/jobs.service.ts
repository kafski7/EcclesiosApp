import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import { ENV, type Env } from "../config/env";
import {
  JOB_SPECS,
  QUEUES,
  type AddOptions,
  type JobContext,
  type JobHandler,
  type JobName,
  type JobPayloads,
  type QueueName,
} from "./job.types";

interface Schedule {
  id: string;
  name: JobName;
  cron: string;
  data: unknown;
}

/**
 * The one way to run background work (functionality §6, D-050).
 *
 * - `bullmq` (dev and production): `add` puts the job on a Redis queue and returns; workers —
 *   in this process when WORKERS=1, or in `pnpm worker` — run it with retries and backoff.
 * - `inline` (tests only; refused in production): `add` runs the handler straight away, once,
 *   and logs instead of throwing, so a test sees the result as soon as the request returns.
 *
 * Processors register handlers in onModuleInit; workers start once every module is ready.
 */
@Injectable()
export class Jobs implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("Jobs");
  private readonly handlers = new Map<JobName, JobHandler<JobName>>();
  private readonly schedules: Schedule[] = [];
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {}

  get inline() {
    return this.env.QUEUE_DRIVER === "inline";
  }

  /** Register the code that runs `name`. One handler per job name. */
  handle<N extends JobName>(name: N, handler: JobHandler<N>) {
    if (this.handlers.has(name)) throw new Error(`Job ${name} already has a handler`);
    this.handlers.set(name, handler as unknown as JobHandler<JobName>);
  }

  /** Run `name` on a cron (APP_TIMEZONE). Ignored by the inline driver. */
  schedule<N extends JobName>(id: string, name: N, cron: string, data: JobPayloads[N]) {
    if (cron.trim()) this.schedules.push({ id, name, cron: cron.trim(), data });
  }

  /** Queue a job. Resolves once it is safely queued (bullmq) or has run (inline). */
  async add<N extends JobName>(name: N, data: JobPayloads[N], opts: AddOptions = {}): Promise<void> {
    if (this.inline) return this.runInline(name, data);
    const spec = JOB_SPECS[name];
    await this.queue(spec.queue).add(name, data, {
      jobId: opts.jobId,
      delay: opts.delayMs,
      attempts: spec.attempts,
      backoff: { type: "exponential", delay: spec.backoffMs },
      removeOnComplete: spec.forget ? true : { age: 7 * 86_400, count: 5_000 },
      removeOnFail: spec.forget ? true : { age: 30 * 86_400 },
    });
  }

  /** Queue many jobs of one kind in one round trip. */
  async addBulk<N extends JobName>(name: N, items: JobPayloads[N][]): Promise<void> {
    if (!items.length) return;
    if (this.inline) {
      for (const data of items) await this.runInline(name, data);
      return;
    }
    const spec = JOB_SPECS[name];
    await this.queue(spec.queue).addBulk(
      items.map((data) => ({
        name,
        data,
        opts: {
          attempts: spec.attempts,
          backoff: { type: "exponential", delay: spec.backoffMs },
          removeOnComplete: spec.forget ? true : { age: 7 * 86_400, count: 5_000 },
          removeOnFail: spec.forget ? true : { age: 30 * 86_400 },
        },
      })),
    );
  }

  /** Run a handler now in this process (tests, and manual triggers). */
  async run<N extends JobName>(name: N, data: JobPayloads[N], ctx: JobContext = { attempt: 1, final: true }) {
    const h = this.handlers.get(name);
    if (!h) throw new Error(`No handler for job ${name}`);
    await h(data, ctx);
  }

  private async runInline<N extends JobName>(name: N, data: JobPayloads[N]) {
    try {
      await this.run(name, data);
    } catch (err) {
      this.logger.error({ err, job: name }, "inline job failed");
    }
  }

  // ------------------------------------------------------------------ redis plumbing

  /**
   * Producers fail fast instead of buffering while Redis is down, so a request never hangs on
   * `add`. (Connection options, not an ioredis instance: bullmq brings its own ioredis.)
   */
  private connection(): ConnectionOptions {
    return { ...redisOptions(this.env.REDIS_URL), enableOfflineQueue: false };
  }

  private queue(name: QueueName) {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection(), prefix: "ecclesios" });
      q.on("error", (err) => this.logger.error({ err, queue: name }, "queue error"));
      this.queues.set(name, q);
    }
    return q;
  }

  async onApplicationBootstrap() {
    if (this.inline || !this.env.WORKERS) return;
    for (const name of QUEUES) {
      const mine = [...this.handlers.keys()].filter((j) => JOB_SPECS[j].queue === name);
      if (!mine.length) continue;
      const worker = new Worker(name, (job: Job) => this.process(job), {
        // Workers block on Redis: their own connection, never giving up on retries.
        connection: { ...redisOptions(this.env.REDIS_URL), maxRetriesPerRequest: null },
        prefix: "ecclesios",
        concurrency: this.env.WORKER_CONCURRENCY,
      });
      worker.on("failed", (job, err) =>
        this.logger.warn(
          { job: job?.name, id: job?.id, attempt: job?.attemptsMade, err: err.message },
          "job attempt failed",
        ),
      );
      worker.on("error", (err) => this.logger.error({ err, queue: name }, "worker error"));
      this.workers.push(worker);
    }
    for (const s of this.schedules)
      await this.queue(JOB_SPECS[s.name].queue).upsertJobScheduler(
        s.id,
        { pattern: s.cron, tz: this.env.APP_TIMEZONE },
        {
          name: s.name,
          data: s.data,
          opts: {
            attempts: JOB_SPECS[s.name].attempts,
            backoff: { type: "exponential", delay: JOB_SPECS[s.name].backoffMs },
          },
        },
      );
    this.logger.log(
      `workers on: ${this.workers.map((w) => w.name).join(", ") || "none"}; ${this.schedules.length} schedule(s)`,
    );
  }

  private async process(job: Job) {
    const h = this.handlers.get(job.name as JobName);
    if (!h) throw new Error(`No handler for job ${job.name}`);
    const attempt = job.attemptsMade + 1;
    await h(job.data, { attempt, final: attempt >= (job.opts.attempts ?? 1) });
  }

  async onApplicationShutdown() {
    await Promise.allSettled(this.workers.map((w) => w.close()));
    await Promise.allSettled([...this.queues.values()].map((q) => q.close()));
  }
}

/** redis[s]://[user:pass@]host[:port][/db] → ioredis options. */
export function redisOptions(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    tls: u.protocol === "rediss:" ? {} : undefined,
  };
}
