import { authError } from "./errors";

/**
 * Fixed-window rate limiting (functionality §6: per IP and per identifier).
 * The store is an interface: in-memory now (single API instance); a Redis store
 * replaces it before running more than one instance (todo Phase 9).
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
}

export interface RateRule {
  key: string;
  limit: number;
  windowMs: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  async hit(key: string, windowMs: number, now: number) {
    if (now - this.lastSweep > 60_000) this.sweep(now);
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }
    b.count += 1;
    return b;
  }

  private sweep(now: number) {
    this.lastSweep = now;
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Counts a hit against every rule; throws RATE_LIMITED if any rule is over its limit. */
  async consume(rules: RateRule[]): Promise<void> {
    const now = this.clock();
    let retryAfterMs = 0;
    for (const r of rules) {
      const { count, resetAt } = await this.store.hit(r.key, r.windowMs, now);
      if (count > r.limit) retryAfterMs = Math.max(retryAfterMs, resetAt - now);
    }
    if (retryAfterMs > 0) throw authError.rateLimited(Math.ceil(retryAfterMs / 1000));
  }
}
