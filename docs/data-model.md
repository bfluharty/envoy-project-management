# Data Model Overview

Envoy Project Management stores application data in PostgreSQL through Lucid
models. Most tables live in the `envoy_schema` schema and use an integer primary
key plus a public UUID for cross-service and URL-safe references.

This document is an ownership and relationship guide, not a column-by-column
schema dump. For exact columns, read `app/models/` and `database/migrations/`.

## Conventions

- Public APIs and URLs should use UUIDs, not integer IDs.
- Most domain tables have `is_active` or status fields instead of hard deletion.
- Timestamps usually use `created_timestamp`, `modified_timestamp`, or a
  domain-specific timestamp such as `sent_timestamp`.
- User-owned data should be queried through the user's UUID and active flags.
- Lookup tables such as currencies, entitlements, statuses, and insight types
  are seeded and referenced by ID internally.

## Core Relationship Map

```text
User
  -> Projects
      -> Conversations
          -> ConversationTurns
      -> ProjectPrompts
      -> ProjectInsights
      -> ProjectVendors
          -> Vendor mappings
              -> VendorListings
          -> OutreachDraft
          -> VendorConversation
              -> Messages
          -> Communications
              -> Messages
  -> Vendors
      -> VendorListings
  -> UserInboxConnections
  -> UserConsentPreference
  -> UserConsentEvents
  -> EmailAuthorizationConsents
```

## Users And Access

| Model                | Table                                | Purpose                                                                                                             |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `User`               | `envoy_schema.users`                 | Authenticated account identity, profile data, role/entitlement, social provider ID, avatar references, active flag. |
| `UserEntitlement`    | `envoy_schema.user_entitlements`     | Seeded entitlement/role lookup such as consumer or vendor.                                                          |
| `PasswordResetToken` | `envoy_schema.password_reset_tokens` | Expiring password reset/setup tokens tied to a user UUID.                                                           |

`User` has many `Project` records through `projects.user_uuid` and many contact
mappings through `vendors.user_uuid`. The user's `entitlement` controls consumer
versus vendor behavior, while `vendor_approval_status` tracks vendor-account
approval state.

Important rules:

- Consumer project APIs should only operate on active users with consumer
  entitlement.
- Password values are hidden from serialization in the model.
- Social auth stores `provider_id`; linked inbox authorization stores provider
  tokens separately in `user_inbox_connections`.

## Projects And Reasoning

| Model              | Table                             | Purpose                                                                                     |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `Project`          | `envoy_schema.projects`           | User-owned project record: title, description, location, dates, budget, goals, active flag. |
| `Conversation`     | `envoy_schema.conversations`      | Project planning/intake conversation container.                                             |
| `ConversationTurn` | `envoy_schema.conversation_turns` | Serialized reasoning turn payload for a project conversation.                               |
| `ProjectPrompt`    | `envoy_schema.projects_prompts`   | Prompt data generated for `PLANNING` and `OUTREACH` agents.                                 |

Project Management owns the persisted project record and conversation history.
`reasoning-engine` owns inference, but Project Management builds the request
context, sends reasoning requests, and saves the returned turns/prompt data.

Relationships:

- `Project.userUuid` belongs to `User.uuid`.
- `Conversation.projectUuid` belongs to `Project.uuid`.
- `ConversationTurn.conversationUuid` belongs to `Conversation.uuid`.
- `ProjectPrompt.projectUuid` belongs to `Project.uuid`.
- `ProjectPrompt.createdByUserUuid` and `modifiedByUserUuid` optionally belong
  to `User.uuid`.

## Vendors, Listings, And Project Contacts

| Model           | Table                          | Purpose                                                                                                                              |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `VendorListing` | `envoy_schema.vendor_listings` | Canonical vendor/business listing with name, optional email, search metadata, ownership/claim state, and active/supersession fields. |
| `Vendor`        | `envoy_schema.vendors`         | User contact mapping to a vendor listing.                                                                                            |
| `ProjectVendor` | `envoy_schema.project_vendors` | Association between one project and one user contact.                                                                                |
| `VendorStatus`  | vendor status lookup table     | Seeded project-vendor status lookup.                                                                                                 |

The model intentionally separates a listing from a user's contact mapping:

- `VendorListing` represents the vendor/business itself.
- `Vendor` represents a user's saved contact entry pointing at a listing.
- `ProjectVendor` represents using that saved contact on a specific project.

This lets search results, consumer-created contacts, and vendor-claimed listings
reuse or converge on the same canonical listing.

Important listing fields:

- `originator`: `CONSUMER`, `SEARCH`, or `VENDOR`.
- `claim_status`: `UNCLAIMED`, `PENDING_CLAIM`, `CLAIMED`, or `CONFLICT`.
- `owner_user_uuid`: consumer owner for consumer-editable listings.
- `claimed_by_user_uuid`: vendor account that claimed a vendor listing.
- `superseded_by_vendor_listing_uuid`: points duplicate listings at a canonical
  listing.
- `fsq_place_id`, `categories`, `fsq_category_ids`, `source_payload`: live search
  and discovery metadata.

Authorization rules:

- A user can edit an unclaimed consumer-owned listing only when
  `owner_user_uuid` matches the user.
- A vendor-claimed listing can only be edited by the claiming vendor account.
- Selecting an available listing creates a `Vendor` mapping but does not grant
  listing edit authority.

## Outreach And Email Conversation Data

| Model                | Table                               | Purpose                                                                                           |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `OutreachDraft`      | `envoy_schema.outreach_drafts`      | Draft, sent, or error state for outreach email tied to a project contact and vendor conversation. |
| `VendorConversation` | `envoy_schema.vendor_conversations` | Email thread between a user and a vendor, optionally tied to a project contact.                   |
| `Communication`      | `envoy_schema.communications`       | Channel-level communication container for a project contact.                                      |
| `Message`            | `envoy_schema.messages`             | Individual inbound or outbound email message with provider IDs and thread headers.                |

Relationships:

- `ProjectVendor` has one `OutreachDraft`.
- `ProjectVendor` has one `VendorConversation`.
- `ProjectVendor` has many `Communication` records.
- `Communication` has many `Message` records.
- `VendorConversation` has many `Message` records.
- `OutreachDraft.sentMessageUuid` optionally points at the sent `Message`.

Message records carry both internal thread references and provider metadata:

- `provider_message_id`
- `provider_thread_id`
- `message_id_header`
- `references_header`
- `direction`: usually `inbound` or `outbound`

Outreach state shown in the UI is derived from drafts, conversations, and
messages. A vendor reply is detected by comparing inbound message timestamps to
the latest outbound message or draft sent timestamp.

## Inbox Authorization And Sync

| Model                       | Table                                       | Purpose                                                                                                        |
| --------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `UserInboxConnection`       | `envoy_schema.user_inbox_connections`       | OAuth-backed connected inbox, encrypted provider tokens, sync cursor, status, and watch/subscription metadata. |
| `EmailAuthorizationConsent` | `envoy_schema.email_authorization_consents` | Audit record for email authorization consent text, terms version, provider, account, IP, and user agent.       |

`UserInboxConnection` stores one connected provider account for a user. It
tracks:

- Provider name and provider user ID.
- Email address.
- Access and refresh tokens.
- Token encryption version.
- Status: `active`, `reauth_required`, or `disconnected`.
- Primary inbox flag.
- Provider sync cursor and last sync error.
- Watch/subscription state for provider push or renewal workflows.

Access and refresh tokens are hidden from model serialization. Service code
should use the inbox connection services to validate, refresh, encrypt, decrypt,
and update token state.

## Project Insights

| Model                  | Table                                   | Purpose                                                               |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `ProjectInsight`       | `envoy_schema.project_insights`         | Durable project-scoped memory extracted from planning/outreach turns. |
| `ProjectInsightType`   | `envoy_schema.project_insight_types`    | Seeded insight type lookup.                                           |
| `ProjectInsightStatus` | `envoy_schema.project_insight_statuses` | Seeded insight status lookup.                                         |

Project insights let later reasoning requests include durable project memory.
The reasoning engine extracts candidate changes and posts them to the internal
insight callback. Project Management validates and applies those changes.

Important fields:

- `project_uuid`: owning project.
- `insight_type_id`: lookup type such as project fact, user preference, risk, or
  open question.
- `status_id`: active/superseded/contradicted/archived state.
- `insight_text`: short self-contained memory.
- `importance`: integer priority.
- `confidence`: optional model confidence.
- `supersedes_insight_uuid` and `superseded_by_insight_uuid`: link replacement
  chains.

Insight updates should preserve history instead of overwriting meaning in place.

## Anonymous Onboarding

| Model                      | Table                                      | Purpose                                                                                                                                        |
| -------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnonymousOnboardingDraft` | `envoy_schema.anonymous_onboarding_drafts` | Pre-registration project description, postal code, vendor discovery results, selected vendors, token, anonymous session, and completion state. |

Anonymous onboarding lets a visitor search vendors and select recommendations
before creating an account. The draft is later consumed into an authenticated
consumer project.

Important fields:

- `token_uuid`: client/session handoff token.
- `anonymous_session_uuid`: session-level anonymous identifier.
- `project_description` and `postal_code`: intake inputs.
- `vendor_searches`: reasoning-generated search classifications.
- `recommended_vendor_listing_uuids`: recommendation result ordering.
- `selected_vendor_listing_uuids`: user selection.
- `status`: `ACTIVE`, `CONSUMED`, `EXPIRED`, or `ABANDONED`.
- `registered_user_uuid`, `consumed_by_user_uuid`, and `consumed_project_uuid`:
  registration and conversion audit fields.

## Consent And Model Training

| Model                                 | Table                                                   | Purpose                                                                                    |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `UserConsentPreference`               | `envoy_schema.user_consent_preferences`                 | Current consent state for terms, privacy policy acknowledgment, and model-training opt-in. |
| `UserConsentEvent`                    | `envoy_schema.user_consent_events`                      | Append-only consent event history.                                                         |
| `ModelTrainingExtractionAudit`        | `envoy_schema.model_training_extraction_audits`         | Audit record for model-training extraction jobs.                                           |
| `ModelTrainingExtractionUserSnapshot` | `envoy_schema.model_training_extraction_user_snapshots` | Snapshot of users eligible for a specific extraction audit.                                |

Consent has two shapes:

- `UserConsentPreference` is the current state used by middleware and account
  settings.
- `UserConsentEvent` is the historical audit trail and should be append-only.

Model-training extraction records should only include users eligible under the
current consent and exclusion policy. Audit rows track job identifier, attempt,
status, categories requested, eligible user count, policy version, lease, and
completion/failure state.

## Lookup Tables

| Model                  | Table                                   | Purpose                                        |
| ---------------------- | --------------------------------------- | ---------------------------------------------- |
| `Currency`             | `envoy_schema.currencies`               | Active currency codes used by project budgets. |
| `UserEntitlement`      | `envoy_schema.user_entitlements`        | Account entitlement/role lookup.               |
| `VendorStatus`         | vendor status lookup table              | Project-vendor workflow statuses.              |
| `ProjectInsightType`   | `envoy_schema.project_insight_types`    | Insight type codes and labels.                 |
| `ProjectInsightStatus` | `envoy_schema.project_insight_statuses` | Insight lifecycle statuses.                    |

Seeders populate these records. Application code should resolve lookup records
by stable codes or canonical names rather than hard-coding numeric IDs.

## Data Ownership Rules

Use these rules when adding features:

- `Project` records are owned by `users.uuid`.
- `Vendor` mappings are owned by `users.uuid`; `VendorListing` edit rights are
  determined by listing ownership or claim state.
- `ProjectVendor` rows must belong to a project owned by the authenticated user.
- `OutreachDraft`, `VendorConversation`, `Communication`, and `Message` rows
  should be accessed through the owning project/contact path.
- `ProjectInsight` rows belong to a project and are updated through the insight
  service so status and supersession behavior stays consistent.
- `UserInboxConnection` rows belong to a user and contain sensitive provider
  tokens; do not serialize token fields.
- Consent event history should be append-only. Update the current preference
  record through `UserConsentService`.

## Migration And Seeder Guidance

When changing the data model:

- Add a forward migration in `database/migrations/`.
- Update the Lucid model when application code needs the new field or
  relationship.
- Update seeders when local development or tests need representative records.
- Add functional tests for behavior that depends on the migration.
- Avoid rewriting shared migrations. Add a new migration instead.
- Keep public APIs using UUIDs even when internal joins use integer IDs.

See [Contributing guide](development/contributing.md) for broader PR
expectations.
