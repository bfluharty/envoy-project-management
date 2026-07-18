# Testing Guide

The project uses Japa for unit and functional API tests and Playwright for UI
tests.

## Test Commands

Run everything:

```bash
npm test
```

Run Japa API tests only:

```bash
npm run test:api
```

Run Playwright UI tests only:

```bash
npm run test:ui
```

Run linting and type checking:

```bash
npm run lint
npm run typecheck
```

## Japa Suites

The configured Japa suites are:

| Suite      | Path                            | Command                                |
| ---------- | ------------------------------- | -------------------------------------- |
| Unit       | `tests/unit/**/*.spec.ts`       | `node ace test unit --no-assets`       |
| Functional | `tests/functional/**/*.spec.ts` | `node ace test functional --no-assets` |

Functional tests start the Adonis HTTP server through `tests/bootstrap.ts`.

Filter Japa tests with standard Ace/Japa options:

```bash
node ace test unit --no-assets --files=tests/unit/project_insight_service.spec.ts
node ace test functional --no-assets --tests="creates a project"
node ace test --no-assets --groups="Project outreach"
```

## UI Tests

Playwright tests live under `tests/ui/`.

```bash
npm run test:ui
```

The Playwright config starts the app automatically with:

```text
HOST=127.0.0.1
PORT=18080
APP_URL=http://127.0.0.1:18080
EMAIL_SYNC_WORKER_ENABLED=false
PASSWORD_AUTH_ENABLED=true
```

The default browser project is desktop Chromium with a `1280x1024` viewport and
dark color scheme. Tests run with one worker, one retry, and a global setup file
at `tests/ui/global_setup.ts`.

## Database Requirements

API tests require PostgreSQL. CI starts a PostgreSQL 16 service with:

```text
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_DATABASE=envoy_test
```

For local testing, point `.env` or command-level environment variables at a
disposable test database. Avoid running destructive local test workflows against
shared development or production data.

## CI Coverage

`.github/workflows/ci.yml` runs on pull requests. It currently executes:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:api
```

CI does not currently run Playwright UI tests. Run UI tests locally for
user-facing changes and include any relevant failures or skipped coverage in the
PR notes.

## What To Test

Add or update tests with every behavior change:

- Use unit tests for isolated services, validators, utilities, model helpers,
  and routing decisions.
- Use functional tests for controllers, middleware, database writes, auth,
  consent, project workflows, vendor workflows, inbox workflows, and internal
  APIs.
- Use Playwright tests for visible UI behavior, navigation, onboarding, account
  settings, consent, contacts, projects, and outreach flows.
- Add regression tests when fixing a bug.

When tests cannot reasonably cover a change, document the reason and the manual
verification performed.
