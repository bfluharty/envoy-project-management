# Envoy Project Management Documentation

This directory contains detailed documentation for the Envoy Project Management
service. The root README is the quick-start and orientation document; these
files hold the longer explanations that should stay close to the codebase.

## Development Docs

- [Architecture overview](architecture.md): service responsibilities, runtime
  boundaries, request layers, data ownership, and background jobs.
- [API reference](api.md): route groups, auth requirements, request payloads,
  response envelopes, and domain errors.
- [Data model overview](data-model.md): major tables, ownership boundaries,
  relationships, and migration guidance.
- [Local development](development/local-development.md): prerequisites,
  environment setup, database setup, native app startup, and common local flows.
- [Docker workflows](development/docker.md): full-stack Docker startup,
  `--local` mode, service ports, image behavior, and troubleshooting.
- [Testing guide](development/testing.md): API, unit, functional, UI, lint,
  typecheck, CI, and targeted test commands.
- [Contributing guide](development/contributing.md): expectations for tests,
  documentation, migrations, frontend changes, and pull requests.

## Feature And Domain Specs

- [Anonymous Consumer Onboarding And Vendor Discovery Spec](features/Anonymous%20Consumer%20Onboarding%20And%20Vendor%20Discovery%20Spec.md)
- [Anonymous Consumer Onboarding And Vendor Discovery Implementation Spec](features/Anonymous%20Consumer%20Onboarding%20And%20Vendor%20Discovery%20Implementation%20Spec.md)
- [Email Authorization And Provider Sync Implementation Spec](features/Email%20Authorization%20And%20Provider%20Sync%20Implementation%20Spec.md)
- [Production Rate Limiting Guide](features/Production%20Rate%20Limiting%20Guide.md)
- [Project-Scoped Insights Generator Spec](features/Project-Scoped%20Insights%20Generator%20Spec.md)
- [User Onboarding Consent And Model Training Preferences Spec](features/user-onboarding-consent-and-model-training-preferences-spec.md)

## Legal Docs

- [Privacy Policy](legal/Privacy%20Policy.md)
- [Terms and Conditions](legal/Terms%20and%20Conditions.md)

## Documentation Rules

Update documentation in the same PR as the code change when any of these change:

- Local setup, Docker, test, or deployment commands.
- Environment variables or required sibling services.
- Route behavior, API contracts, user-facing workflows, or background jobs.
- Database ownership, migrations, seed data, or domain model responsibilities.
- Legal, consent, privacy, or model-training behavior.
