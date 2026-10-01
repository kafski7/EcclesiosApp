# @ecclesios/db

Drizzle schema, migrations and dev seeds for Ecclesios (blueprint §7).

- `src/schema/` — tables and Postgres enums (enums are generated from `@ecclesios/shared` constants so TS and SQL can't drift)
- `src/seed/` — dev-only wipe-and-reload seed with deterministic UUIDs
- `drizzle/` — generated SQL migrations (committed; never hand-edited)

## Workflow

1. **Generate** — edit `src/schema/`, then `pnpm db:generate` and review the SQL in `./drizzle` before committing.
2. **Migrate** — `pnpm db:migrate` applies pending migrations to the database.
3. **Seed** — `pnpm db:seed` wipes and reloads dev data (`pnpm db:reset` wipes only). Refuses to run against non-local hosts unless `SEED_ALLOW_REMOTE=1`.
