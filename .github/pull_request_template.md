## What & why

<!-- One or two sentences. Link the todo.md item(s): e.g. "Phase 2 — Auth module: verify-otp" -->

## Type

- [ ] feat - [ ] fix - [ ] refactor - [ ] docs - [ ] chore - [ ] test

## Checklist (Standing Rules — docs/todo.md)

- [ ] Docs updated first if this changes behaviour described in blueprint.md / functionality.md (and a row added to docs/decisions.md)
- [ ] API contract changes made in `packages/shared` (Zod) before consumers
- [ ] Schema changes are drizzle-kit migrations (no manual/live edits)
- [ ] Binaries go to object storage; slow work goes to BullMQ
- [ ] RBAC tests included (own-scope CRUD + hierarchy-level denials) where applicable
- [ ] No v1 accounting tables/logic added
- [ ] No secrets committed; `.env.example` updated for any new variable

## How to test

<!-- Steps / commands -->
