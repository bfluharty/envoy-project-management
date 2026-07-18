# Envoy Project Management

Envoy Project Management is the primary web application and API for Envoy. It
helps consumers turn an initial project need into a managed vendor outreach
workflow: onboarding captures the project, vendor discovery finds candidate
services, planning prompts collect missing details, outreach drafts messages,
and inbox sync keeps the project conversation connected to vendor replies.

The repo is an AdonisJS 6 application with an Inertia/Svelte frontend,
PostgreSQL persistence, Playwright UI coverage, and Japa unit/functional API
tests. It integrates with sibling Envoy services for reasoning and email:

- `reasoning-engine` generates planning, outreach, insight, and vendor-search
  decisions.
- `envoy-email-service` sends and synchronizes email with connected inboxes.
- PostgreSQL stores users, projects, vendors, conversations, consent, insights,
  outreach drafts, and email authorization state.

## Table Of Contents

- [Purpose](#purpose)
- [Repository Layout](#repository-layout)
- [Documentation Index](#documentation-index)
- [Local Setup](#local-setup)
- [Running The App](#running-the-app)
- [Testing](#testing)
- [Docker](#docker)
- [Contributing](#contributing)

## Purpose

This service owns the user-facing project-management experience and the
project-management domain model. It is responsible for:

- Public onboarding, project capture, vendor search, and registration handoff.
- Authenticated dashboards for projects, contacts, outreach, account settings,
  inbox settings, privacy, terms, and consent preferences.
- Project, vendor, contact, conversation, outreach, inbox, consent, and insight
  APIs.
- Persistence of project-scoped prompts, reasoning turns, outreach drafts,
  active insights, vendor relationships, and model-training consent records.
- Internal callback endpoints used by the reasoning engine to persist extracted
  project insights.
- Background commands and providers for inbox sync, email watch renewal, and
  pending consent cleanup.

## Repository Layout

| Path                 | Purpose                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.api/`              | Generated/local API clients, including the checked-in Foursquare Places SDK dependency used by vendor search.             |
| `.github/workflows/` | CI plus dev/prod deployment workflows for GitHub Actions, ECR, ECS, and migration tasks.                                  |
| `.husky/`            | Git hooks. The pre-commit hook runs lint-staged and type checking.                                                        |
| `app/`               | Main AdonisJS application code: controllers, middleware, models, validators, services, mailers, constants, and utilities. |
| `bin/`               | Adonis runtime entry points for server, console, and test runner execution.                                               |
| `commands/`          | Custom Ace commands for inbox sync, diagnostics, watch renewal, and cleanup jobs.                                         |
| `config/`            | Adonis configuration for app, auth, CORS, database, mail, sessions, static assets, Vite, and internal inbox settings.     |
| `database/`          | Lucid migrations and seeders for all persistent Envoy tables and local test/dev data.                                     |
| `docs/`              | Project documentation, feature specs, legal docs, and development guides. Start with [docs/README.md](docs/README.md).    |
| `inertia/`           | Svelte/Inertia frontend app, pages, components, stores, CSS, and SSR entry points.                                        |
| `providers/`         | Custom Adonis providers for test Vite behavior and background workers.                                                    |
| `public/`            | Static browser assets, currently focused on favicon and web manifest files.                                               |
| `resources/`         | Edge views and browser bootstrap assets used by Adonis/Inertia.                                                           |
| `scripts/`           | Utility scripts, including local SQL cleanup helpers.                                                                     |
| `start/`             | Adonis boot files: route definitions, middleware aliases, and environment validation.                                     |
| `tests/`             | Unit, functional, and Playwright UI tests plus shared helpers and fixtures.                                               |
| `types/`             | Shared TypeScript DTOs for reasoning requests, project prompts, insights, and turns.                                      |

Generated or local-only paths such as `build/`, `node_modules/`, `test-results/`,
and `.env` should not be treated as source documentation.

## Documentation Index

Core development docs:

- [Documentation home](docs/README.md)
- [Architecture overview](docs/architecture.md)
- [API reference](docs/api.md)
- [Data model overview](docs/data-model.md)
- [Local development](docs/development/local-development.md)
- [Docker workflows](docs/development/docker.md)
- [Testing guide](docs/development/testing.md)
- [Contributing guide](docs/development/contributing.md)

Feature and domain docs:

- [Anonymous Consumer Onboarding And Vendor Discovery Spec](docs/features/Anonymous%20Consumer%20Onboarding%20And%20Vendor%20Discovery%20Spec.md)
- [Anonymous Consumer Onboarding And Vendor Discovery Implementation Spec](docs/features/Anonymous%20Consumer%20Onboarding%20And%20Vendor%20Discovery%20Implementation%20Spec.md)
- [Email Authorization And Provider Sync Implementation Spec](docs/features/Email%20Authorization%20And%20Provider%20Sync%20Implementation%20Spec.md)
- [Production Rate Limiting Guide](docs/features/Production%20Rate%20Limiting%20Guide.md)
- [Project-Scoped Insights Generator Spec](docs/features/Project-Scoped%20Insights%20Generator%20Spec.md)
- [User Onboarding Consent And Model Training Preferences Spec](docs/features/user-onboarding-consent-and-model-training-preferences-spec.md)

Legal docs:

- [Privacy Policy](docs/legal/Privacy%20Policy.md)
- [Terms and Conditions](docs/legal/Terms%20and%20Conditions.md)

## Local Setup

Prerequisites:

- Node.js 20 or newer. The project is currently developed with Node 22.
- npm.
- PostgreSQL 16, either installed locally or started through Docker.
- Docker Desktop if you want the full local stack.
- Sibling clones of `reasoning-engine` and `envoy-email-service` when running the
  full Docker workflow.

Install dependencies:

```bash
npm ci
```

Create local environment variables:

```bash
cp .env.example .env
node ace generate:key
```

Paste the generated `APP_KEY` into `.env`, then fill any required secrets. At a
minimum, local app execution needs database settings, `APP_URL`,
`REASONING_ENGINE_URL`, and any third-party keys required by the flow you are
testing.

Run migrations and seeders against the configured database:

```bash
npm run migrate
npm run seed
```

See [Local development](docs/development/local-development.md) for environment
details and common setup paths.

## Running The App

Run just the Project Management service natively:

```bash
npm run dev
```

The default local app URL is:

```text
http://localhost:8080
```

For a production-style local start:

```bash
npm run build
npm start
```

Run dependencies in Docker while keeping this app native:

```bash
npm run dev:local
```

That command runs `sh run-docker.sh --local`, starts Postgres,
`reasoning-engine`, and `envoy-email-service` in Docker, runs migrations and
seeders locally, then starts `npm run dev`.

## Testing

Run all tests:

```bash
npm test
```

Run API tests only. This includes the Japa `unit` and `functional` suites:

```bash
npm run test:api
```

Run a single Japa suite:

```bash
node ace test unit --no-assets
node ace test functional --no-assets
```

Run UI tests:

```bash
npm run test:ui
```

Run quality checks:

```bash
npm run lint
npm run typecheck
```

The Playwright config starts the app on `http://127.0.0.1:18080` for UI tests.
The CI workflow currently runs lint, typecheck, and `npm run test:api` on pull
requests. See [Testing guide](docs/development/testing.md) for database,
environment, filtering, and UI-test notes.

## Docker

Run the full local Envoy stack with Docker:

```bash
./run-docker.sh
```

The default Docker workflow builds images, resets the project-management
`node_modules` volume, starts Postgres, starts `reasoning-engine` and
`envoy-email-service`, runs migrations and seeders, then starts this app in a
live-reload container.

Expected local ports:

| Service            | Port   |
| ------------------ | ------ |
| Project Management | `8080` |
| Reasoning Engine   | `8081` |
| Email Service      | `8083` |
| PostgreSQL         | `5432` |

See [Docker workflows](docs/development/docker.md) for prerequisites, sibling
repo expectations, local-mode behavior, and troubleshooting.

## Contributing

Before opening a PR:

- Keep changes scoped to the feature or fix.
- Add or update tests for every behavior change.
- Include unit tests for isolated service/model/validator behavior.
- Include functional tests for controller, middleware, database, and API
  behavior.
- Include Playwright tests for user-facing UI behavior and critical flows.
- Run `npm run lint`, `npm run typecheck`, and the relevant test suites.
- Update README/docs when commands, architecture, flows, routes, environment
  variables, or operational expectations change.
- Never commit `.env`, secrets, generated build output, local test artifacts, or
  dependency folders.

See the full [Contributing guide](docs/development/contributing.md) for test
coverage expectations, migration rules, documentation requirements, and PR
checks.
