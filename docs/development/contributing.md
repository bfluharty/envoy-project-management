# Contributing Guide

This project should stay easy to run, test, and reason about. Keep pull requests
focused and update tests and documentation with the code.

## Before Changing Code

Read the surrounding code before choosing an approach. Prefer existing Adonis,
Lucid, Inertia, Svelte, service, validator, and test patterns over introducing a
new abstraction.

Use the narrowest change that solves the problem. Avoid unrelated refactors,
format-only churn, and migration rewrites.

## Test Requirements

Every behavior change needs tests.

Expected coverage by change type:

| Change type                                                         | Expected tests                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Pure utility/service logic                                          | Unit tests under `tests/unit/`.                                      |
| Validators, controllers, middleware, auth, database writes, or APIs | Functional tests under `tests/functional/`.                          |
| User-visible flows or UI state                                      | Playwright tests under `tests/ui/`.                                  |
| Bug fixes                                                           | A regression test that fails without the fix.                        |
| Migrations                                                          | Functional coverage for the behavior that depends on the new schema. |

Run at least the relevant subset locally before opening a PR. For broad changes,
run:

```bash
npm run lint
npm run typecheck
npm run test:api
npm run test:ui
```

## Documentation Requirements

Update documentation in the same PR when changing:

- Setup, Docker, test, deployment, or migration commands.
- Environment variables.
- API contracts, route behavior, or service boundaries.
- User-facing flows, consent behavior, privacy behavior, or model-training data
  use.
- Background jobs, email sync behavior, or external integrations.
- Directory structure or ownership expectations.

Put quick-start information in the root README and detailed explanations under
`docs/`.

## Database Changes

Use forward-only migrations. Do not edit migrations that have already been
shared unless the team explicitly decides the migration has not been consumed.

When adding schema:

- Add model updates when needed.
- Add or adjust seeders when local/dev/test data needs the new shape.
- Backfill or default data intentionally.
- Test the behavior that depends on the migration.

## Frontend Changes

Follow the existing Svelte/Inertia component patterns. Keep pages focused on the
workflow they support and move reusable pieces into `inertia/components/` only
when they are genuinely shared.

For UI changes:

- Verify text fits at the tested viewport sizes.
- Keep interactive controls keyboard and screen-reader friendly where practical.
- Add Playwright coverage for critical user flows.
- Avoid changing global styling unless the change is intended to affect the
  whole app.

## External Integrations

Keep calls to reasoning, email, OAuth providers, Foursquare, and queues behind
service classes. Controllers should validate, authorize, delegate, and shape the
response.

When adding or changing an integration:

- Add timeout/error handling where the existing service pattern supports it.
- Do not log secrets, tokens, authorization codes, or provider payloads that may
  contain sensitive user data.
- Use environment variables validated in `start/env.ts`.
- Document new required variables in `.env.example` and relevant docs.

## Pull Request Checklist

Before requesting review:

- Code is scoped to the stated change.
- Tests were added or updated for all behavior changes.
- `npm run lint` passes.
- `npm run typecheck` passes.
- Relevant Japa and Playwright tests pass.
- Docs and `.env.example` are updated when needed.
- No secrets, `.env` files, build output, dependency folders, or local artifacts
  are included.
