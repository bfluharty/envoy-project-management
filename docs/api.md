# API Reference

This document summarizes the HTTP surface defined in `start/routes.ts`. It is a
developer reference for the current application routes, expected authentication
state, request payloads, and response envelopes.

The route file and validators remain the source of truth:

- Routes: `start/routes.ts`
- Project validators: `app/validators/projects_validator.ts`
- Vendor validators: `app/validators/vendors_validator.ts`
- Outreach validators: `app/validators/outreach_validator.ts`
- Onboarding validators: `app/validators/onboarding_validator.ts`
- Insight validators: `app/validators/project_insights_validator.ts`

## Conventions

Most JSON APIs require an authenticated, active consumer user with current
consent. Session cookies are the primary auth mechanism. Authenticated consumer
API groups use:

```text
auth -> consent -> consumer
```

Inbox and outreach-send APIs additionally require an active connected inbox:

```text
auth -> consent -> activeInbox
```

Validation errors are returned by Adonis/Vine as `422` responses unless a
controller handles a domain error explicitly. Domain errors commonly use:

| Status | Meaning                                                                       |
| ------ | ----------------------------------------------------------------------------- |
| `400`  | Valid request shape, but the requested domain operation is invalid.           |
| `401`  | No authenticated session.                                                     |
| `403`  | Authenticated user is not authorized for the route or role.                   |
| `404`  | User-owned resource, project, contact, draft, or thread was not found.        |
| `409`  | Connected inbox is required or another recoverable state conflict exists.     |
| `429`  | Rate limit exceeded.                                                          |
| `500`  | Unexpected application failure.                                               |
| `502`  | A dependency such as reasoning or vendor discovery failed in a retryable way. |

UUID path parameters must be valid UUID strings.

## Infrastructure Routes

| Method | Path       | Auth | Purpose                                    |
| ------ | ---------- | ---- | ------------------------------------------ |
| `GET`  | `/health`  | None | Liveness plus database connectivity check. |
| `GET`  | `/version` | None | Build traceability endpoint.               |

`GET /health` returns:

```json
{
  "status": "ok",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

If the database check fails, it returns `503` with `status: "error"`.

`GET /version` returns:

```json
{
  "sha": "git-sha-or-unknown",
  "builtAt": "build-timestamp-or-unknown",
  "environment": "local"
}
```

## Public Onboarding API

These endpoints support the anonymous onboarding flow before registration.

| Method  | Path                               | Auth | Purpose                                                                   |
| ------- | ---------------------------------- | ---- | ------------------------------------------------------------------------- |
| `POST`  | `/onboarding/draft/restore`        | None | Restore an active anonymous onboarding draft by token.                    |
| `POST`  | `/onboarding/vendor-search`        | None | Search for vendor recommendations and create/update an anonymous draft.   |
| `PATCH` | `/onboarding/vendor-selection`     | None | Persist selected vendor listing UUIDs on an anonymous draft.              |
| `POST`  | `/onboarding/registration-handoff` | None | Store the onboarding token in session before redirecting to registration. |

### Restore Onboarding Draft

Request:

```json
{
  "onboardingToken": "uuid-v4"
}
```

Success response:

```json
{
  "draftUuid": "uuid",
  "projectDescription": "Need a deck contractor",
  "postalCode": "23220",
  "vendorSearches": [],
  "vendors": [],
  "selectedVendorListingUuids": [],
  "step": "intake",
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

`step` is one of `intake`, `recommendations`, or `selection`.

### Vendor Search

Request:

```json
{
  "projectDescription": "Need a licensed electrician for a panel upgrade",
  "postalCode": "23220"
}
```

Validation:

| Field                | Rule                                            |
| -------------------- | ----------------------------------------------- |
| `projectDescription` | Required string, trimmed, 5 to 2000 characters. |
| `postalCode`         | Required string, trimmed, 1 to 64 characters.   |

Success response includes a draft token/UUID, generated vendor searches,
recommended public vendor listings, selected listings, expiration, and optional
empty-state/dependency metadata. Dependency failures return `502` with
`retryable: true`.

### Vendor Selection

Request:

```json
{
  "onboardingToken": "uuid-v4",
  "selectedVendorListingUuids": ["uuid-v4"]
}
```

`selectedVendorListingUuids` may contain 0 to 8 UUID v4 values.

Success response:

```json
{
  "selectedCount": 1,
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

### Registration Handoff

Request:

```json
{
  "onboardingToken": "uuid-v4"
}
```

Success response:

```json
{
  "redirectTo": "/register?accountType=consumer"
}
```

## Project API

All `/api/projects` routes require an authenticated, active consumer with
current consent.

| Method  | Path                               | Purpose                                                     |
| ------- | ---------------------------------- | ----------------------------------------------------------- |
| `GET`   | `/api/projects`                    | List current user's active projects.                        |
| `GET`   | `/api/projects/:uuid`              | Get one active project with current vendors.                |
| `POST`  | `/api/projects`                    | Create a project and run initial intake.                    |
| `PATCH` | `/api/projects/:uuid`              | Update project fields and vendor associations.              |
| `POST`  | `/api/projects/:uuid/vendors`      | Attach existing vendor listings to a project.               |
| `POST`  | `/api/projects/:uuid/intake/retry` | Retry reasoning intake and planning prompt-data generation. |
| `POST`  | `/api/projects/:uuid/chat`         | Send a project-planning prompt to the reasoning engine.     |

### List Projects

Query parameters:

| Field    | Rule                          |
| -------- | ----------------------------- |
| `limit`  | Optional number, minimum `1`. |
| `offset` | Optional number, minimum `0`. |

Success response:

```json
{
  "projects": [],
  "count": 0,
  "limit": 10,
  "offset": 0
}
```

### Get Project

Success response:

```json
{
  "project": {
    "uuid": "uuid",
    "title": "Kitchen remodel",
    "vendors": []
  }
}
```

The exact project object follows the serialized Lucid `Project` model and
includes active vendor mappings when present.

### Create Project

Request:

```json
{
  "title": "Kitchen remodel",
  "description": "Replace cabinets and counters",
  "location": {
    "postalCode": "23220"
  },
  "startDate": "2026-08-01",
  "endDate": "2026-09-01",
  "deadline": "2026-09-15",
  "budgetAmount": 15000,
  "budgetCurrency": "USD",
  "goals": "Keep the existing footprint",
  "vendors": ["vendor-uuid"]
}
```

Validation:

| Field            | Rule                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| `title`          | Required string, trimmed, at least 1 character.                              |
| `description`    | Optional string.                                                             |
| `location`       | Optional object; unknown properties allowed.                                 |
| `startDate`      | Optional date, today or later, not after `endDate` or `deadline`.            |
| `endDate`        | Optional date, today or later, not before `startDate`, not after `deadline`. |
| `deadline`       | Optional date, today or later, not before `startDate` or `endDate`.          |
| `budgetAmount`   | Optional number, minimum `0`.                                                |
| `budgetCurrency` | Optional currency code; must resolve to an active currency.                  |
| `goals`          | Optional string.                                                             |
| `vendors`        | Optional array of vendor UUIDs owned by the user.                            |
| `isActive`       | Optional boolean; cannot be `false` on create.                               |

Success responses:

- `201` with `{ "combinedProject": { ... } }` when create and intake both
  succeed.
- `203` with `{ "project": { ... }, "errors": [...] }` when the project is
  created but a downstream operation such as intake has warnings/errors.

### Update Project

Request body accepts the same project fields as create, but all fields are
optional and date ordering is not revalidated across fields.

Success response:

```json
{
  "project": {
    "uuid": "uuid",
    "title": "Updated title",
    "vendors": []
  }
}
```

The controller currently returns `201` for successful updates.

### Attach Vendor Listings

Request:

```json
{
  "vendorListingUuids": ["uuid-v4"]
}
```

`vendorListingUuids` must contain 1 to 8 UUID v4 values. The service resolves
canonical available listings, creates or reactivates user contact mappings, and
attaches them to the project.

### Retry Intake

Success response:

```json
{
  "success": true
}
```

Failures return `404` for missing projects or `502` for reasoning/intake
failures.

### Project Chat

Request:

```json
{
  "prompt": "We need the work done before Labor Day."
}
```

The prompt must be a non-empty trimmed string. This route is rate limited per
user/project/IP and delegates to `reasoning-engine`. The response is the
reasoning engine chat response after Project Management persists the turn and
any resulting project state.

## Vendor And Contact API

All `/api/vendors` routes require an authenticated, active consumer with current
consent.

| Method  | Path                           | Purpose                                                                       |
| ------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `GET`   | `/api/vendors`                 | List the user's active contact library.                                       |
| `GET`   | `/api/vendors/available`       | List globally available vendor listings with redacted public data.            |
| `GET`   | `/api/vendors/trusted-matches` | Find trusted existing listings by name or email.                              |
| `POST`  | `/api/vendors/search`          | Run authenticated vendor discovery for a project description and postal code. |
| `POST`  | `/api/vendors/:uuid/select`    | Add an available vendor listing to the user's contacts.                       |
| `GET`   | `/api/vendors/:uuid`           | Get one user contact by vendor listing UUID.                                  |
| `POST`  | `/api/vendors`                 | Create a consumer-owned contact listing and user mapping.                     |
| `PATCH` | `/api/vendors/:uuid`           | Update or deactivate a user contact/listing.                                  |

### List Contacts

Query parameters:

| Field    | Rule                          |
| -------- | ----------------------------- |
| `limit`  | Optional number, minimum `1`. |
| `offset` | Optional number, minimum `0`. |

Success response:

```json
{
  "vendors": [],
  "count": 0,
  "limit": 10,
  "offset": 0
}
```

### Available Vendor Listings

Success response:

```json
{
  "vendors": [
    {
      "vendorListingUuid": "uuid",
      "name": "Example Vendor",
      "categories": [],
      "location": null,
      "hasEmail": true,
      "onboardedToEnvoy": false,
      "consumerOwned": false,
      "ownershipWarning": null
    }
  ],
  "count": 1,
  "limit": 10,
  "offset": 0
}
```

Public recommendation DTOs intentionally omit direct email and source payload
details.

### Trusted Matches

Query parameters:

| Field   | Rule                               |
| ------- | ---------------------------------- |
| `name`  | Optional non-empty trimmed string. |
| `email` | Optional trimmed email.            |

At least one useful search field should be supplied. The endpoint returns
claimed/vendor-originated listings only.

### Authenticated Vendor Search

Request:

```json
{
  "projectDescription": "Need catering for a backyard party",
  "postalCode": "23220"
}
```

Success response:

```json
{
  "vendorSearches": [],
  "vendors": [],
  "emptyStateReason": null,
  "liveSearchUnavailable": false
}
```

Returned vendors use the authenticated recommendation DTO, which adds:

```json
{
  "inContacts": true,
  "vendorUuid": "uuid-or-null"
}
```

The route is rate limited and can return `502` with `retryable: true` when
vendor discovery dependencies fail.

### Select Available Listing

`POST /api/vendors/:uuid/select` uses `:uuid` as a vendor listing UUID.

Success response:

```json
{
  "vendorUuid": "uuid",
  "savedToContacts": true,
  "listing": {
    "vendorListingUuid": "uuid",
    "name": "Example Vendor",
    "inContacts": true,
    "vendorUuid": "uuid"
  }
}
```

Selecting a listing creates or reactivates the user's contact mapping. It does
not grant edit authority over a listing the user does not own or claim.

### Create Contact

Request:

```json
{
  "name": "Example Vendor",
  "email": "vendor@example.com"
}
```

Validation:

| Field      | Rule                                           |
| ---------- | ---------------------------------------------- |
| `name`     | Required non-empty trimmed string.             |
| `email`    | Required non-empty trimmed email.              |
| `isActive` | Optional boolean; cannot be `false` on create. |

Creates a consumer-owned `vendor_listings` record and an active `vendors`
mapping for the current user.

### Update Contact

Request:

```json
{
  "name": "Updated Vendor",
  "email": "new@example.com",
  "isActive": true
}
```

All fields are optional. Setting `isActive: false` soft-deletes the user's
mapping. Name/email updates require edit authority over the underlying listing.

## Outreach API

All project outreach routes require an authenticated user with current consent
and an active inbox because the route group uses `activeInbox`.

| Method   | Path                                                              | Purpose                                                 |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `GET`    | `/api/projects/:uuid/outreach`                                    | Load outreach cards for a project.                      |
| `POST`   | `/api/projects/:uuid/outreach/drafts`                             | Create a blank draft thread for a project contact.      |
| `POST`   | `/api/projects/:uuid/outreach/sync`                               | Queue inbox backfill and return updated outreach state. |
| `DELETE` | `/api/projects/:uuid/outreach/drafts/:draftUuid`                  | Cancel/delete a draft and empty thread.                 |
| `POST`   | `/api/projects/:uuid/outreach/drafts/:draftUuid/send`             | Send a draft through the connected inbox.               |
| `POST`   | `/api/projects/:uuid/outreach/drafts/:draftUuid/retry`            | Retry a draft in `error` state.                         |
| `POST`   | `/api/projects/:uuid/outreach/drafts/:draftUuid/revise`           | Revise a draft with the reasoning engine.               |
| `POST`   | `/api/projects/:uuid/outreach/threads/:threadUuid/replies`        | Send a reply on an existing outreach thread.            |
| `POST`   | `/api/projects/:uuid/outreach/threads/:threadUuid/replies/revise` | Generate a revised reply body for a thread.             |

### Outreach State Envelope

Most outreach actions return the full project outreach state:

```json
{
  "cards": [
    {
      "threadUuid": "uuid",
      "projectVendorUuid": "uuid",
      "draftUuid": "uuid-or-null",
      "vendor": {
        "uuid": "vendor-mapping-uuid",
        "name": "Example Vendor",
        "email": "vendor@example.com"
      },
      "status": "draft",
      "subject": "Subject",
      "body": "Message body",
      "sentAt": null,
      "lastActivityAt": "2026-01-01T00:00:00.000Z",
      "needsAttention": false,
      "lastError": null,
      "replyReceived": false,
      "thread": {
        "uuid": "uuid",
        "messages": []
      }
    }
  ],
  "hasConnectedInbox": true,
  "senderMode": "connected_inbox"
}
```

`status` is draft-backed when a draft exists. Otherwise it reflects the thread:
`received`, `sent`, or `empty`. Draft errors use `error`.

Thread messages contain:

```json
{
  "uuid": "uuid",
  "direction": "inbound",
  "subject": "Subject",
  "from": "sender@example.com",
  "to": "recipient@example.com",
  "body": "Message body",
  "sentAt": "2026-01-01T00:00:00.000Z",
  "messageId": "<message-id@example.com>",
  "references": "<prior-message-id@example.com>",
  "threadId": "provider-thread-id"
}
```

### Create Draft

Request accepts one identifier:

```json
{
  "projectVendorUuid": "uuid"
}
```

or:

```json
{
  "vendorUuid": "uuid"
}
```

### Send Draft

Request:

```json
{
  "subject": "Optional override subject",
  "body": "Optional override body"
}
```

If provided, overrides are trimmed and used instead of the saved draft values.
The final subject and body must be non-empty.

### Revise Draft

Request:

```json
{
  "instructions": "Make this shorter and friendlier.",
  "subject": "Optional current subject",
  "body": "Optional current body"
}
```

`instructions` is required. The route is rate limited per user/project/IP.

### Send Thread Reply

Request:

```json
{
  "subject": "Re: Project quote",
  "body": "Thanks, can you send availability?",
  "inReplyTo": "<optional-message-id>",
  "references": "<optional-references>",
  "threadId": "optional-provider-thread-id"
}
```

`subject` and `body` are required non-empty strings.

### Revise Thread Reply

Request:

```json
{
  "instructions": "Ask for a weekend appointment.",
  "body": "Optional current body"
}
```

Success response is the outreach state plus:

```json
{
  "revisedThreadUuid": "uuid",
  "revisedReplyBody": "Generated reply body"
}
```

## Inbox API

| Method | Path               | Auth                        | Purpose                                       |
| ------ | ------------------ | --------------------------- | --------------------------------------------- |
| `POST` | `/api/inbox/reply` | Auth, consent, active inbox | Send a direct reply to a vendor conversation. |

Request:

```json
{
  "connectionId": 123,
  "vendorConversationUuid": "uuid",
  "to": "vendor@example.com",
  "subject": "Re: Project",
  "body": "Reply body",
  "inReplyTo": "<optional-message-id>",
  "references": "<optional-references>",
  "threadId": "optional-provider-thread-id"
}
```

`connectionId` is optional. If omitted, the user's active primary inbox
connection is used. `to`, `subject`, `body`, and `vendorConversationUuid` are
required by controller checks.

Success response:

```json
{
  "message": {
    "uuid": "uuid"
  }
}
```

## Internal Reasoning Callback API

Internal routes are intended for service-to-service use by `reasoning-engine`.
They are not session-protected in `start/routes.ts`, so deployment-level network
boundaries and any future service authentication are important for production
hardening.

| Method | Path                                       | Purpose                                  |
| ------ | ------------------------------------------ | ---------------------------------------- |
| `POST` | `/internal/projects/:projectUuid/insights` | Apply extracted project insight changes. |

Request:

```json
{
  "new_insights": [
    {
      "insight_type": "PROJECT_FACT",
      "insight_text": "The project is in Richmond.",
      "importance": 4,
      "confidence": 0.9
    }
  ],
  "updates": [
    {
      "existing_insight_uuid": "uuid",
      "operation": "superseded",
      "replacement_insight": {
        "insight_type": "PROJECT_CONSTRAINT",
        "insight_text": "Budget is now $40,000.",
        "importance": 5,
        "confidence": 0.8
      }
    }
  ]
}
```

Validation:

| Field                             | Rule                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `new_insights`                    | Optional array.                                                                            |
| `new_insights[].insight_type`     | Required non-empty string; service validates known type codes.                             |
| `new_insights[].insight_text`     | Required non-empty string, max 500 characters.                                             |
| `new_insights[].importance`       | Optional integer from 1 to 5.                                                              |
| `new_insights[].confidence`       | Optional number from 0 to 1.                                                               |
| `updates`                         | Optional array.                                                                            |
| `updates[].existing_insight_uuid` | Required UUID.                                                                             |
| `updates[].operation`             | Required; normalized to lowercase and must be `superseded`, `contradicted`, or `archived`. |
| `updates[].replacement_insight`   | Optional insight payload, used for supersession.                                           |

Success response:

```json
{
  "created_count": 1,
  "updated_count": 1,
  "skipped_count": 0
}
```

## Browser Workflow Routes With JSON Responses

Some web routes return JSON even though they are not under `/api`.

| Method   | Path                        | Auth                       | Purpose                                  |
| -------- | --------------------------- | -------------------------- | ---------------------------------------- |
| `POST`   | `/contacts`                 | Auth, consent, consumer    | Create a contact from the Contacts page. |
| `PATCH`  | `/contacts/:uuid`           | Auth, consent, consumer    | Inline update a contact.                 |
| `DELETE` | `/contacts/:uuid`           | Auth, consent, consumer    | Soft-delete a contact.                   |
| `POST`   | `/account/avatar`           | Auth, consent              | Upload an avatar image.                  |
| `DELETE` | `/account/avatar`           | Auth, consent              | Remove the uploaded avatar.              |
| `GET`    | `/account/avatar/google`    | Auth, consent              | Proxy the linked Google avatar image.    |
| `PATCH`  | `/account/data-preferences` | Auth, consent, same origin | Update model-training opt-in preference. |

Contact routes reuse vendor validators. Account routes are primarily form or
redirect based, except Google avatar proxying.

## Page And Form Routes

The app also exposes Inertia page routes and browser form actions for login,
registration, password reset, consent, inbox connection, dashboard, projects,
contacts, account, vendor onboarding, privacy, terms, and contact pages. These
routes are documented here only as a map:

| Area                          | Routes                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Public pages                  | `GET /`, `/privacy`, `/terms`, `/contact`                                                                             |
| Auth                          | `GET/POST /login`, `GET/POST /register`, `GET /auth/:provider`, `GET /auth/:provider/callback`, password reset routes |
| Consent                       | `GET/POST /onboarding/consent`                                                                                        |
| Onboarding project completion | `GET/POST /onboarding/project`                                                                                        |
| Dashboard/account             | `GET /dashboard`, `GET /account`, account form posts                                                                  |
| Inbox pages                   | `GET /inbox/emails`, `/inbox/settings`, `/inbox/connect`, `/inbox/callback`, `POST /inbox/disconnect`                 |
| Project pages                 | `GET/POST /projects`, `GET/PATCH /projects/:uuid`, `GET /projects/:uuid/greeting`, `POST /projects/:uuid/chat`        |
| Vendor pages                  | `GET /vendor/pending`, `GET /vendor/listing`                                                                          |

When adding routes, update this document, `start/routes.ts`, validators, and
functional or Playwright tests together.
