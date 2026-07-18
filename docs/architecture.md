# Architecture Overview

Envoy Project Management is the central application for the Envoy consumer
project workflow. It owns the web UI, authenticated project-management API,
PostgreSQL data model, and callbacks used by sibling services.

## Runtime Shape

The app is built with:

- AdonisJS 6 for HTTP routing, middleware, controllers, validation, sessions,
  auth, mail, providers, commands, and Lucid models.
- Inertia with Svelte for server-driven frontend pages.
- PostgreSQL for durable application state.
- Playwright for browser-level UI coverage.
- Japa for unit and functional API coverage.

The service normally runs on port `8080`. The Docker workflow also starts:

- `reasoning-engine` on port `8081`.
- `envoy-email-service` on port `8083`.
- PostgreSQL on port `5432`.

## Service Responsibilities

Project Management owns:

- Users, auth sessions, social login, password recovery, account settings, and
  avatars.
- Consumer onboarding drafts, project creation, and registration handoff.
- Projects, prompts, planning state, conversation turns, project-scoped
  insights, and outreach drafts.
- Vendors, vendor listings, project-vendor relationships, and trusted-match
  search.
- Email authorization, connected inbox state, inbox sync records, vendor
  conversations, communications, and messages.
- Consent preferences and append-only consent events used by model-training
  eligibility flows.
- Internal persistence endpoints used by `reasoning-engine`.

It does not own LLM inference or provider email delivery. Those are delegated to
the sibling reasoning and email services through configured internal URLs.

## Request Layers

The request path is organized around Adonis conventions:

- `start/routes.ts` defines public pages, auth pages, project routes, API routes,
  internal callback routes, health checks, and the final page fallback.
- `start/kernel.ts` registers middleware aliases used by routes.
- `app/middleware/` enforces auth, guest-only access, consumer role access,
  consent requirements, active inbox requirements, same-origin checks, JSON
  responses, and silent auth.
- `app/controllers/web/` renders Inertia pages and handles browser workflows.
- `app/controllers/api/` handles JSON APIs and internal service callbacks.
- `app/validators/` defines Vine validators for incoming payloads.
- `app/services/` holds business logic and external service integration.
- `app/models/` defines Lucid models for database-backed domain objects.

## Frontend

Frontend code lives under `inertia/`:

- `inertia/pages/` maps Inertia page names to Svelte screens.
- `inertia/components/` contains shared UI components.
- `inertia/stores/` contains client-side state shared by components.
- `inertia/css/` contains app styling.
- `inertia/app/` contains browser and SSR entry points.

Server-side route handlers return Inertia pages, and frontend components call
web or API endpoints for interactive behavior.

## Database

Database schema changes live in `database/migrations/`. Seed data lives in
`database/seeders/` and supports local development, tests, and seeded demo
states.

When changing persisted behavior:

- Add a migration for schema changes.
- Keep migrations forward-only and deterministic.
- Update seeders when local/test workflows need representative data.
- Add functional tests when controller, service, or database behavior changes.

## Background Work

Custom Ace commands in `commands/` and providers in `providers/` support
background work such as:

- Inbox sync and diagnostics.
- Email watch renewal.
- Email sync event processing.
- Pending consent cleanup.

Local and deployed behavior is controlled by environment variables validated in
`start/env.ts`.

## External Boundaries

Important external boundaries:

- `REASONING_ENGINE_URL` points to the reasoning service used for project
  planning, outreach, vendor discovery, and insight extraction flows.
- `EMAIL_SERVICE_URL` points to the email service used for outbound messages and
  provider-backed email sync.
- `FOURSQUARE_PLACES_API_KEY` enables vendor-place search.
- Google and Microsoft OAuth credentials enable social auth and inbox
  authorization flows.
- SQS environment variables configure deployed email sync queue behavior.

Prefer keeping external-service calls behind `app/services/` classes so
controllers remain thin and behavior stays testable.
