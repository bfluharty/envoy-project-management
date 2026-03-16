# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server with HMR (hot module reload)
npm run build        # Build for production
npm start            # Start production server

# Database
npm run migrate      # Run pending migrations
npm run seed         # Run database seeders

# Code quality
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript type checking (no emit)

# Testing
npm test             # Run all tests (Japa test runner)
node ace test --files="tests/functional/your_test.spec.ts"  # Run a single test file
```

## Architecture Overview

This is an **AdonisJS v6** backend with **Inertia.js + Svelte 5** for the frontend, using **PostgreSQL** with Lucid ORM.

### Dual Controller Pattern

Routes are split into two parallel controller layers:

- **Web controllers** (`app/controllers/web/`) — Session-authenticated, return Inertia renders or redirects. Auth is enforced via AdonisJS session middleware.
- **API controllers** (`app/controllers/api/`) — Stateless, intended for the external reasoning engine service. Authentication is done by validating `x-user-id` header against the database (via `validateUser` in `app/utils/controller_utils.ts`).

Both controller types share the same service layer.

### External Reasoning Engine

The app integrates with a sibling service (`reasoning-engine`, run alongside via Docker Compose). When a user chats about a project:

1. The controller fetches the project with its full conversation history.
2. It POSTs a `ReasoningRequest` (prompt + past turns + project UUID) to the reasoning engine URL.
3. `ReasoningEngineService` receives the `Turn` response, saves it via `ProjectService.saveConversationTurn`, and returns the model response.

The reasoning engine URL is configured via `REASONING_ENGINE_URL_DEV` / `REASONING_ENGINE_URL_PROD` env vars.

### Database Schema

All tables live under the `envoy_schema` PostgreSQL schema. Key relationships:

- `User` → `Project` (one-to-many, via `user_uuid`)
- `Project` → `Conversation` → `ConversationTurn` (one project has one conversation; turns store full `Turn` objects as JSONB)
- `Project` ↔ `Vendor` via `project_vendor` join table (soft-delete pattern: `is_active` flag)
- `Vendor` → `VendorStatus`
- `User` → `UserEntitlement`

Models use `uuid` (not `id`) as the public-facing identifier. UUIDs are auto-generated on `beforeCreate`.

### Path Aliases

The `imports` field in `package.json` defines aliases (e.g., `#controllers/*`, `#models/*`, `#services/*`) that map to `app/` subdirectories. Use these instead of relative paths.

### Frontend

Svelte pages live in `inertia/pages/`. Shared components are in `inertia/components/`. CSS uses Tailwind v4 + Skeleton UI. The Inertia SSR entrypoint is `inertia/app/ssr.ts`.

### Environment Setup

Copy `.env.example` to `.env` and fill in:
- `APP_KEY` — generate with `node ace generate:key`
- Database credentials (`DB_*`)
- `REASONING_ENGINE_URL_DEV` — defaults to `http://localhost:8081/reasoning/chat`
- `RESEND_API_KEY` — for transactional email (password reset)

For Docker-based local development, run `./run-docker.sh` which starts both this service and the reasoning engine together.
