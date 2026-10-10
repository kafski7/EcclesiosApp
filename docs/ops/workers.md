# Workers, SMS and email (Phase 7, D-050)

## Development

`docker compose up -d` starts Redis. `pnpm dev` runs the API **with the workers inside it** (`WORKERS=1`).
With `SMS_PROVIDER=console` and `EMAIL_PROVIDER=console`, OTP codes and messages are printed in the API log.

E2E tests set `QUEUE_DRIVER=inline` (jobs run immediately in the test process) — no Redis needed.

## Production

| Process | Command | Env |
| --- | --- | --- |
| API (1+ instances) | `node apps/api/dist/main.js` | `WORKERS=0` |
| Workers (1+ instances) | `node apps/api/dist/worker.js` (`pnpm --filter @ecclesios/api worker`) | same env as the API |

- Both need `REDIS_URL` (use `rediss://` for TLS). Redis should persist (AOF) — queued messages live there.
- `QUEUE_DRIVER=bullmq`, `SMS_PROVIDER=hubtel`, `EMAIL_PROVIDER=smtp` (the API refuses to start otherwise).
- Hubtel: `HUBTEL_SMS_CLIENT_ID`, `HUBTEL_SMS_CLIENT_SECRET`, an **approved** `SMS_SENDER_ID`. Do one live test send
  and confirm the request/response shape against Hubtel's current docs before launch.
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (SPF/DKIM set up for the domain).
- The birthday digest runs once a day at `BIRTHDAY_DIGEST_CRON` in `APP_TIMEZONE`; any number of worker instances is
  safe (BullMQ job scheduler + `digest_runs`).

## Queues

| Queue | Jobs | Attempts / first backoff |
| --- | --- | --- |
| `messages` | `otp.send`, `message.expand`, `message.deliver` | 3 / 2 s · 3 / 10 s · 4 / 30 s |
| `notifications` | `notify` | 3 / 5 s |
| `scheduled` | `digest.birthdays` | 3 / 60 s |
| `accounting` | `collection.sync` | 3 / 60 s |

Keys are prefixed `ecclesios:`. Failed jobs are kept 30 days for inspection.
