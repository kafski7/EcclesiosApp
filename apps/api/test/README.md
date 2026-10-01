# API end-to-end tests

Run against a real, seeded Postgres:

```bash
docker compose up -d postgres
pnpm db:setup                       # migrate + seed
pnpm --filter @ecclesios/api build  # builds shared + db first via turbo deps if run with turbo
pnpm --filter @ecclesios/api test:e2e
```

The suite resets the auth state of the seed accounts it uses before and after running,
so it can be re-run without re-seeding. OTPs are captured in memory (no console needed).
