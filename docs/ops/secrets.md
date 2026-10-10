# Secret Management Plan

## Principles

1. **No secrets in code or in git.** Only `.env.example` files (with dummy values) are committed.
2. **No `.env` files in deploy artifacts.** Production containers receive secrets as environment variables injected by the host platform at runtime.
3. **Browser apps hold no secrets.** Anything prefixed `VITE_` is public by design.
4. **Least privilege.** Each service gets only the credentials it needs.

## Environments

| Env            | Where secrets live                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Local dev      | `apps/*/.env`, `packages/db/.env` copied from `.env.example` (git-ignored)                                     |
| CI             | GitHub Actions secrets (only what tests need)                                                                  |
| Staging / Prod | Host platform's secret store or a vault (Doppler / AWS Secrets Manager / Azure Key Vault) — chosen in Phase 10 |

## Secret inventory

| Secret                                     | Used by               | Rotation                                |
| ------------------------------------------ | --------------------- | --------------------------------------- |
| `DATABASE_URL`                             | api, db tooling       | on staff change / annually              |
| `REDIS_URL`                                | api (workers)         | annually                                |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`          | api                   | annually                                |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | api                   | annually; rotation invalidates sessions |
| `HUBTEL_SMS_CLIENT_ID` / `HUBTEL_SMS_CLIENT_SECRET`, `SMTP_USER` / `SMTP_PASS` | api + workers (Phase 7) | per provider |
| Accounting API credentials                 | api (Phase 6)         | per provider                            |
| Bible provider key (API.Bible)             | api (Phase 5.2)       | per provider                            |

## Rules

- Generate JWT secrets with ≥64 random bytes (`openssl rand -base64 64`).
- The API validates required env vars at boot (Zod env schema, Phase 2) and refuses to start if any are missing.
- A leaked secret is rotated immediately and noted in ops notes.
