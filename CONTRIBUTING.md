# Contributing to Ecclesios

## Branches

`<type>/<phase>-<short-description>` — e.g. `feat/p2-verify-otp`, `fix/p6-outstation-approval`.

- `main` is always deployable and protected: PR + green CI required, no direct pushes.
- One todo.md item (or a tight group) per PR.

## Commits — Conventional Commits

`<type>(<scope>): <summary>`

| type     | use for               |
| -------- | --------------------- |
| feat     | new functionality     |
| fix      | bug fix               |
| refactor | no behaviour change   |
| test     | tests only            |
| docs     | docs only             |
| chore    | tooling, deps, config |
| ci       | pipeline changes      |

Scopes: `api`, `web`, `admin`, `shared`, `db`, `config`, `infra`, `docs`, `tools`.

Breaking contract changes: add `!` (`feat(shared)!: ...`) and explain in the body.

## Pull requests

Use the PR template. Every PR must pass: format, lint, typecheck, unit tests, migrations.

## Standing rules

See the bottom of `docs/todo.md`. Docs are the contract — change the doc first (and log it in
`docs/decisions.md`), then the code.
