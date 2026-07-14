# Anonymous Consumer Onboarding And Vendor Discovery Implementation Specification

## 1. Overview

This document describes the implementation plan for the anonymous consumer onboarding and vendor discovery flow.

It covers changes across:

- `envoy-project-management`
- `reasoning-engine`
- Postgres schema
- Inertia/Svelte UI
- Foursquare Places integration
- Vendor listing ownership and claim-aware authorization

The product and architecture decisions are defined in:

```text
docs/Anonymous Consumer Onboarding And Vendor Discovery Spec.md
```

---

## 2. Existing Code Touchpoints

### 2.1 Project-Management App

Relevant files:

```text
start/routes.ts
start/env.ts
app/controllers/web/auth_controller.ts
app/controllers/web/dashboard_controller.ts
app/controllers/web/projects/projects_controller.ts
app/services/project_service.ts
app/services/vendor_service.ts
app/services/vendor_search_service.ts
app/services/project_outreach_service.ts
app/services/reasoning_engine_service.ts
app/validators/auth_validator.ts
app/validators/projects_validator.ts
app/validators/vendors_validator.ts
inertia/pages/landing.svelte
inertia/pages/auth/register.svelte
inertia/pages/home.svelte
inertia/pages/projects/project.svelte
```

Current models:

```text
app/models/user.ts
app/models/user_entitlement.ts
app/models/project.ts
app/models/vendor.ts
app/models/vendor_listing.ts
app/models/project_vendor.ts
app/models/outreach_draft.ts
app/models/vendor_conversation.ts
```

Current migrations of interest:

```text
database/migrations/1768253005324_add_entitlement_to_users.ts
database/migrations/1768253006324_insert_entitlements.ts
database/migrations/1774212252319_associate_vendors_to_users.ts
database/migrations/1775000000000_add_outreach_drafts_and_project_scoped_threads.ts
database/migrations/1779151309327_vendor_listings_redesign.ts
```

### 2.2 Reasoning Engine

Relevant files:

```text
src/models/request.ts
src/index.ts
src/services/reasoning-service.ts
src/utils/validation-utils.ts
```

---

## 3. Route Design

### 3.1 Public Routes

Add or update:

```ts
router.get('/', [OnboardingController, 'show']).as('onboarding.show')
router.post('/onboarding/draft/restore', [OnboardingController, 'restoreDraft'])
router.post('/onboarding/vendor-search', [OnboardingController, 'searchVendors'])
router.patch('/onboarding/vendor-selection', [OnboardingController, 'updateSelection'])
router.get('/onboarding/project', [OnboardingProjectController, 'show']).middleware(middleware.auth())
router.post('/onboarding/project', [OnboardingProjectController, 'store']).middleware(middleware.auth())
```

Keep existing routes:

```ts
router.get('/login', [AuthController, 'showLogin'])
router.get('/register', [AuthController, 'showRegister'])
router.post('/register', [AuthController, 'register'])
```

Registration should accept:

```http
GET /register?accountType=consumer
GET /register?accountType=vendor
```

The raw onboarding token must not be included in registration URLs. The token is sent in request bodies for anonymous API calls, or temporarily stored in the anonymous Adonis session if a redirect to registration is needed.

Optional handoff route:

```ts
router.post('/onboarding/registration-handoff', [OnboardingController, 'registrationHandoff'])
```

`registrationHandoff` reads a UUID v4 `onboardingToken` from the request body, validates that the draft is active, stores the token in session under `onboarding.token`, and redirects to `/register?accountType=consumer`. The same endpoint must be called before any third-party OAuth/social sign-up redirect so the token survives the external redirect round trip.

### 3.2 Root Behavior

Authenticated root behavior:

```text
if authenticated consumer:
  redirect /dashboard

if authenticated approved vendor:
  redirect /vendor/listing

if authenticated pending vendor:
  redirect /vendor/pending
```

Anonymous root behavior is client-driven because the onboarding token is stored in localStorage and is not visible during the initial server request:

```text
render anonymous onboarding shell

if anonymous and valid onboarding token exists:
  restore draft state from POST /onboarding/draft/restore and route to the latest completed anonymous step

if anonymous and seen-site marker exists and no valid onboarding token exists:
  clear `envoy_seen` and stale onboarding storage, then show blank intake

otherwise:
  show blank intake
```

Implementation details:

- Add `POST /onboarding/draft/restore` to validate and restore the draft for the token sent by the client in the request body.
- Set an HTTP-only anonymous onboarding session cookie before or during the first `/onboarding/vendor-search` request.
- Set `envoy_seen=true` only after a successful `/onboarding/vendor-search` response, not on first page load.
- A stale or expired onboarding token should be cleared and ignored.
- Stale anonymous state should never force a user to `/login`; only explicit login actions or authenticated-route guards should do that.
- A valid onboarding token always wins over stale browser flags.

### 3.3 Anonymous Session Cookie

Project-management must maintain an HTTP-only anonymous onboarding session cookie for visitors who interact with the intake flow.

Requirements:

- The cookie/session maps to an `anonymous_session_uuid`.
- The value must be generated server-side as UUID v4.
- It must be created before or during the first `/onboarding/vendor-search` request.
- It is used only for server-side draft grouping, supersession, and abandonment analytics.
- It does not replace the localStorage onboarding token, which is still used by the Svelte client for anonymous API calls.
- If the user clears localStorage, existing drafts for that anonymous session may still be abandoned by a later draft from the same cookie/session.
- If the user clears cookies or uses a new/incognito browser, older drafts cannot be associated to the new anonymous session and will expire through the normal 24-hour cleanup path.

---

## 4. Data Model Changes

### 4.1 Entitlements

Existing entitlement values should become:

```text
CONSUMER
VENDOR
ADMIN
```

Migration behavior:

```sql
update envoy_schema.user_entitlements
set title = 'Consumer',
    canonical_name = 'CONSUMER',
    modified_by = 'system',
    modified_timestamp = now()
where canonical_name = 'USER';

insert into envoy_schema.user_entitlements
  (title, canonical_name, created_by, created_timestamp, modified_by, modified_timestamp, is_active)
values
  ('Vendor', 'VENDOR', 'system', now(), 'system', now(), true)
on conflict (canonical_name) do nothing;
```

Code should resolve entitlements by `canonical_name`, not hardcoded ID.

Add helper/service:

```ts
class EntitlementService {
  static async getIdByCanonicalName(canonicalName: 'CONSUMER' | 'VENDOR' | 'ADMIN'): Promise<number>
}
```

### 4.2 Users

Add vendor approval fields to `users` or create a small vendor profile table.

Recommended MVP: add to `users` to keep the first pass simple.

```sql
alter table envoy_schema.users
add column vendor_approval_status varchar(32) null default null,
add column vendor_approved_at timestamptz null;
```

Allowed values:

```text
PENDING
APPROVED
REJECTED
```

For consumer users, `vendor_approval_status` remains `null`.

### 4.3 Vendor Listings

Expand `vendor_listings` into the canonical marketplace listing table that can store first-party, vendor-claimed, and Foursquare-search-originated listings.

Required originator values:

```text
CONSUMER
SEARCH
VENDOR
```

Migration should:

- Convert existing consumer-created listing rows to `CONSUMER`.
- Convert any legacy external-search originator value to `SEARCH`.
- Update the originator check constraint to `CONSUMER`, `SEARCH`, `VENDOR`.

Add or alter fields:

```sql
alter table envoy_schema.vendor_listings
  alter column email drop not null,
  add column fsq_place_id text null,
  add column categories text[] not null default '{}',
  add column phone_number varchar(32) null,
  add column website text null,
  add column date_refreshed date null,
  add column location jsonb null,
  add column source_payload jsonb null,
  add column owner_user_uuid uuid null,
  add column claimed_by_user_uuid uuid null,
  add column claimed_at timestamptz null,
  add column claim_status varchar(32) not null default 'UNCLAIMED',
  add column superseded_by_vendor_listing_uuid uuid null;
```

Recommended constraints and indexes:

```sql
create unique index vendor_listings_fsq_place_id_unique
  on envoy_schema.vendor_listings (fsq_place_id)
  where fsq_place_id is not null;

create index vendor_listings_originator_idx
  on envoy_schema.vendor_listings (originator);

create index vendor_listings_categories_gin_idx
  on envoy_schema.vendor_listings using gin (categories);

create index vendor_listings_date_refreshed_idx
  on envoy_schema.vendor_listings (date_refreshed desc);

create index vendor_listings_location_postcode_idx
  on envoy_schema.vendor_listings ((location->>'postcode'));

alter table envoy_schema.vendor_listings
add constraint vendor_listings_claimed_by_user_uuid_foreign
foreign key (claimed_by_user_uuid)
references envoy_schema.users(uuid);

alter table envoy_schema.vendor_listings
add constraint vendor_listings_owner_user_uuid_foreign
foreign key (owner_user_uuid)
references envoy_schema.users(uuid);

alter table envoy_schema.vendor_listings
add constraint vendor_listings_superseded_by_foreign
foreign key (superseded_by_vendor_listing_uuid)
references envoy_schema.vendor_listings(uuid);

alter table envoy_schema.vendor_listings
add constraint vendor_listings_claim_status_check
check (claim_status in ('UNCLAIMED', 'PENDING_CLAIM', 'CLAIMED', 'CONFLICT'));

create index vendor_listings_owner_user_uuid_idx
  on envoy_schema.vendor_listings (owner_user_uuid)
  where owner_user_uuid is not null;

create index vendor_listings_superseded_by_idx
  on envoy_schema.vendor_listings (superseded_by_vendor_listing_uuid)
  where superseded_by_vendor_listing_uuid is not null;
```

UUID columns in new migrations should use PostgreSQL `uuid`, not `text`. Existing model properties can remain TypeScript `string`.

If any referenced legacy UUID columns are still `text` in the local schema, add a prerequisite migration to convert the referenced columns before adding UUID foreign keys. Do not create foreign keys between `text` and `uuid` columns.

Location JSON shape:

```json
{
  "address": "12550 Battery Dantzler Ct",
  "locality": "Chester",
  "region": "VA",
  "postcode": "23836",
  "country": "US",
  "formatted_address": "12550 Battery Dantzler Ct, Chester, VA 23836"
}
```

### 4.4 Anonymous Onboarding Drafts

Create a new table:

```sql
create table envoy_schema.anonymous_onboarding_drafts (
  id bigserial primary key,
  uuid uuid not null unique,
  token_uuid uuid not null unique,
  project_description text not null,
  postal_code text not null,
  vendor_searches jsonb not null default '[]'::jsonb,
  recommended_vendor_listing_uuids uuid[] not null default '{}',
  selected_vendor_listing_uuids uuid[] not null default '{}',
  status varchar(32) not null default 'ACTIVE',
  anonymous_session_uuid uuid not null,
  registered_user_uuid uuid null references envoy_schema.users(uuid),
  consumed_by_user_uuid uuid null references envoy_schema.users(uuid),
  consumed_project_uuid uuid null references envoy_schema.projects(uuid),
  expires_at timestamptz not null,
  created_timestamp timestamptz not null default now(),
  updated_timestamp timestamptz not null default now()
);
```

Statuses:

```text
ACTIVE
CONSUMED
EXPIRED
ABANDONED
```

Indexes:

```sql
create index anonymous_onboarding_drafts_status_expires_idx
  on envoy_schema.anonymous_onboarding_drafts (status, expires_at);

create index anonymous_onboarding_drafts_consumed_by_user_uuid_idx
  on envoy_schema.anonymous_onboarding_drafts (consumed_by_user_uuid);

create index anonymous_onboarding_drafts_registered_user_uuid_idx
  on envoy_schema.anonymous_onboarding_drafts (registered_user_uuid);

create index anonymous_onboarding_drafts_anonymous_session_active_idx
  on envoy_schema.anonymous_onboarding_drafts (anonymous_session_uuid, status);

create unique index anonymous_onboarding_drafts_consumed_project_unique
  on envoy_schema.anonymous_onboarding_drafts (consumed_project_uuid)
  where consumed_project_uuid is not null;

create index anonymous_onboarding_drafts_recommended_vendor_uuids_gin_idx
  on envoy_schema.anonymous_onboarding_drafts using gin (recommended_vendor_listing_uuids);

create index anonymous_onboarding_drafts_selected_vendor_uuids_gin_idx
  on envoy_schema.anonymous_onboarding_drafts using gin (selected_vendor_listing_uuids);
```

PostgreSQL array elements cannot carry individual foreign keys. Services must validate every listing UUID before writing either array and must resolve the UUIDs again inside the project creation transaction.

Token handling:

- Generate the onboarding token as UUID v4.
- Store the UUID v4 token in `anonymous_onboarding_drafts.token_uuid`.
- Return/store the UUID v4 token in localStorage under `envoy_onboarding_token`.
- Generate or reuse a separate non-secret anonymous session UUID stored server-side in an HTTP-only cookie/session.
- Expiration defaults to 24 hours.
- Creating a new draft marks prior active drafts for the same `anonymous_session_uuid` as `ABANDONED`.
- Draft lookup enforces `status = ACTIVE` and `expires_at > now()`.
- Expired active rows are marked `EXPIRED` by a cleanup command or scheduled job.

### 4.5 Vendor Listing Ownership

`originator` is immutable provenance. Edit authority is derived independently:

- `claim_status = 'CLAIMED'`: only `claimed_by_user_uuid` may edit canonical listing data. This is the sole condition for `onboardedToEnvoy = true`.
- Unclaimed listing with `owner_user_uuid`: only that consumer may edit listing data.
- Unclaimed listing without `owner_user_uuid`: consumers cannot edit listing data.
- An ownerless `SEARCH` listing without email is assigned to the first consumer who adds it to a project. Use a conditional update inside the project transaction so concurrent additions cannot create multiple owners.
- An email-bearing `SEARCH` listing remains ownerless and consumer-immutable until claimed.
- Search ingestion never refreshes or overwrites an existing listing.

All active listings with no `superseded_by_vendor_listing_uuid` are available for consumers to add to projects regardless of ownership. Availability never grants edit authority.

---

## 5. Models

### 5.1 `AnonymousOnboardingDraft`

Add:

```text
app/models/anonymous_onboarding_draft.ts
```

Fields:

```ts
uuid: string
tokenUuid: string
projectDescription: string
postalCode: string
vendorSearches: unknown[]
recommendedVendorListingUuids: string[]
selectedVendorListingUuids: string[]
status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'ABANDONED'
anonymousSessionUuid: string
registeredUserUuid: string | null
consumedByUserUuid: string | null
consumedProjectUuid: string | null
expiresAt: DateTime
createdTimestamp: DateTime
updatedTimestamp: DateTime
```

### 5.2 `VendorListing`

Update:

```text
app/models/vendor_listing.ts
```

Add:

```ts
declare email: string | null
declare originator: 'CONSUMER' | 'SEARCH' | 'VENDOR'
declare fsqPlaceId: string | null
declare categories: string[]
declare phoneNumber: string | null
declare website: string | null
declare dateRefreshed: DateTime | null
declare location: {
  address?: string
  locality?: string
  region?: string
  postcode?: string
  country?: string
  formatted_address?: string
} | null
declare sourcePayload: unknown | null
declare ownerUserUuid: string | null
declare claimedByUserUuid: string | null
declare claimedAt: DateTime | null
declare claimStatus: 'UNCLAIMED' | 'PENDING_CLAIM' | 'CLAIMED' | 'CONFLICT'
declare supersededByVendorListingUuid: string | null
```

`email` is nullable. Search-originated listings are inserted even when Foursquare does not provide email. `originator` remains `SEARCH` if a consumer later gains edit authority.

### 5.3 `User`

Update:

```text
app/models/user.ts
```

Add:

```ts
vendorApprovalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
vendorApprovedAt: DateTime | null
```

---

## 6. Request And Response Contracts

### 6.1 Public Vendor Search Request

```http
POST /onboarding/vendor-search
```

Request:

```json
{
  "projectDescription": "I need to renovate a small restaurant space before opening.",
  "postalCode": "23220"
}
```

Response:

```json
{
  "onboardingToken": "7d9b5f0a-79b9-4b73-8b25-79677e31c2c5",
  "draftUuid": "uuid",
  "vendorSearches": [
    {
      "classification": "commercial general contractor",
      "query": "commercial general contractor restaurant renovation",
      "rationale": "The project requires buildout coordination and construction execution."
    }
  ],
  "vendors": [
    {
      "vendorListingUuid": "uuid",
      "name": "Richmond Build Co.",
      "categories": ["Commercial Contractor", "Construction"],
      "location": {
        "address": "456 Broad St",
        "locality": "Richmond",
        "region": "VA",
        "postcode": "23220",
        "country": "US",
        "formatted_address": "456 Broad St, Richmond, VA 23220"
      },
      "hasEmail": true,
      "onboardedToEnvoy": false,
      "consumerOwned": false,
      "ownershipWarning": null
    }
  ],
  "expiresAt": "2026-06-17T20:15:00.000Z"
}
```

Every normalized Foursquare result is inserted or matched to a `vendor_listing` before this response is built. The response contains at most eight listings. Relevant existing Envoy listings rank first regardless of claim status; within that tier and the remaining live-result tier, email-bearing listings rank before no-email listings. Raw source data and contact fields are not returned to the anonymous UI.

If no usable Foursquare results or existing listings can be returned, return `200` with an empty `vendors` array and:

```json
{
  "emptyStateReason": "NO_VENDOR_RESULTS"
}
```

The UI should show a no-vendors-found state and let the user edit the project description or ZIP code. It should not allow continuation to registration from an empty recommendation list.

### 6.2 Draft Restore Request

```http
POST /onboarding/draft/restore
```

Request:

```json
{
  "onboardingToken": "7d9b5f0a-79b9-4b73-8b25-79677e31c2c5"
}
```

Response:

```json
{
  "draftUuid": "uuid",
  "projectDescription": "I need to renovate a small restaurant space before opening.",
  "postalCode": "23220",
  "vendorSearches": [],
  "vendors": [],
  "selectedVendorListingUuids": [],
  "step": "recommendations",
  "expiresAt": "2026-06-17T20:15:00.000Z"
}
```

If the token is missing, invalid, expired, consumed, or abandoned, return `404` or `410` and the client should clear `envoy_onboarding_token`, clear `envoy_seen`, and show a blank intake.

### 6.3 Vendor Selection Request

```http
PATCH /onboarding/vendor-selection
```

Request:

```json
{
  "onboardingToken": "7d9b5f0a-79b9-4b73-8b25-79677e31c2c5",
  "selectedVendorListingUuids": ["uuid"]
}
```

Validation:

- `onboardingToken` is required and must be UUID v4.
- `selectedVendorListingUuids` must contain 1 to 8 UUIDs.
- Every selected UUID must exist in the draft's `recommended_vendor_listing_uuids`.
- Every selected UUID must resolve to an active, non-superseded listing or a canonical replacement.
- Missing email does not make a listing ineligible for selection.

Response:

```json
{
  "selectedCount": 1,
  "expiresAt": "2026-06-17T20:15:00.000Z"
}
```

### 6.4 Registration Request

Extend existing `/register` request:

```json
{
  "fullName": "Jane Consumer",
  "email": "jane@example.com",
  "password": "password123",
  "passwordConfirmation": "password123",
  "accountType": "consumer",
  "onboardingToken": "7d9b5f0a-79b9-4b73-8b25-79677e31c2c5"
}
```

The token is accepted only in the POST body or from `session.get('onboarding.token')`. It must be UUID v4 and must not be accepted from a query string.

Vendor registration:

```json
{
  "fullName": "Vendor Owner",
  "email": "owner@example.com",
  "password": "password123",
  "passwordConfirmation": "password123",
  "accountType": "vendor"
}
```

### 6.5 Project Completion Request

```http
POST /onboarding/project
```

Request:

```json
{
  "title": "Restaurant Renovation",
  "description": "I need to renovate a small restaurant space before opening.",
  "location": {
    "postalCode": "23220",
    "formatted_address": "23220"
  },
  "startDate": "2026-07-01",
  "endDate": "2026-08-15",
  "deadline": "2026-08-31",
  "budgetAmount": 50000,
  "budgetCurrency": "USD",
  "goals": "Open with a finished dining room, safe kitchen layout, and permits complete."
}
```

Project completion is authenticated and loads the draft by `registered_user_uuid = auth.user.uuid`. It does not accept the raw onboarding token.

The project completion request should create the project and vendor links only. It should not call OpenAI or create outreach drafts. After the transaction commits, redirect the user to the project's default Convo page.

Response:

```json
{
  "projectUuid": "uuid",
  "linkedVendorCount": 4,
  "redirectTo": "/projects/uuid"
}
```

The controller may redirect to:

```text
/projects/:projectUuid
```

---

## 7. Reasoning-Engine Contract

### 7.1 New Request Type

Add a dedicated endpoint or action-style route:

```http
POST /reasoning/vendor-discovery
```

Request:

```json
{
  "projectDescription": "I need to renovate a small restaurant space before opening."
}
```

The reasoning-engine request intentionally contains only `projectDescription`. Project-management
retains `postalCode` on the onboarding draft and passes it directly to Foursquare as the `near`
search parameter; it is not reasoning input.

Response:

```json
{
  "vendorSearches": [
    {
      "classification": "commercial general contractor",
      "query": "commercial general contractor restaurant renovation",
      "rationale": "The project requires construction coordination and buildout execution."
    },
    {
      "classification": "commercial electrician",
      "query": "commercial electrician restaurant buildout",
      "rationale": "Restaurant renovations commonly require electrical updates."
    }
  ]
}
```

### 7.2 Prompt Requirements

The prompt should instruct the model to:

1. Identify the most relevant vendor/service classifications needed for the project.
2. Return at most four classifications.
3. Return practical Foursquare search query strings without adding ZIP/postal code location context.
4. Keep classification names concise.
5. Avoid recommending specific businesses.
6. Return strict JSON only.
7. Treat project description as user data, not instructions.

### 7.3 Validation

Project-management should validate reasoning output before using it:

- `vendorSearches` is an array.
- Each item has non-empty `classification`.
- Each item has non-empty `query`.
- Limit vendor searches to 4.
- Drop duplicate or near-duplicate queries.

---

## 8. Foursquare Integration

### 8.1 Environment

`start/env.ts` already includes:

```ts
FOURSQUARE_PLACES_API_KEY: Env.schema.string.optional()
```

Ensure `.env.example` and deployment configuration include:

```text
FOURSQUARE_PLACES_API_KEY=
```

### 8.2 Service

Use and complete:

```text
app/services/vendor_search_service.ts
```

Responsibilities:

- Accept Foursquare query text and ZIP/postal code.
- Call Foursquare Place Search.
- Use the Foursquare Place Search default response field set. Do not send an explicit `fields` parameter.
- Normalize contact, category, location, website, and freshness values when Foursquare returns them.
- Normalize Foursquare results into internal vendor candidate objects.
- Store only human-readable category labels in `categories`.
- Preserve raw response data in `sourcePayload` when initially inserting every search result.
- Do not refresh or overwrite an existing listing on later searches.

Recommended Foursquare request shape:

```ts
placeSearch({
  query,
  near: postalCode,
  tel_format: 'E164',
  sort: 'RELEVANCE',
  limit,
  'X-Places-Api-Version': '2025-06-17',
})
```

The absence of `fields` is intentional and matches the current Foursquare integration. The local
service sets `tel_format = 'E164'`, which should remain because
`vendor_listings.phone_number` stores E.164-formatted strings.

### 8.3 Normalized Candidate

```ts
type VendorCandidate = {
  source: 'SEARCH'
  vendorListingUuid: string
  fsqPlaceId: string | null
  name: string
  email: string | null
  categories: string[]
  phoneNumber: string | null
  website: string | null
  dateRefreshed: string | null
  location: {
    address?: string
    locality?: string
    region?: string
    postcode?: string
    country?: string
    formatted_address?: string
  } | null
  onboardedToEnvoy: boolean
  consumerOwned: boolean
  ownershipWarning: string | null
  sourcePayload: unknown
}
```

### 8.4 Result Limits

Recommended MVP limits:

- Max vendor searches/classifications: 4.
- Max Foursquare calls: 4.
- Max Foursquare results per query: 50.
- Max recommendations returned: 8.
- Max selected vendors: 8.

---

## 9. Vendor Discovery Service

Add or update:

```text
app/services/onboarding_vendor_discovery_service.ts
```

Responsibilities:

1. Validate intake.
2. Create or update an anonymous onboarding draft.
3. Call reasoning-engine vendor discovery endpoint.
4. Call Foursquare through `vendor_search_service`.
5. Normalize Foursquare responses, including results without email.
6. Dedupe candidates produced by the current search batch.
7. Insert or reuse a `vendor_listing` for every normalized candidate.
8. Do not overwrite listings that already exist.
9. Merge relevant existing listings with persisted live results, rank the relevant existing tier first regardless of claim status, and then rank each tier with email first and no-email listings afterward.
10. Store the top eight recommendation UUIDs and any selected UUIDs on the draft.
11. Return the top eight recommendations to the UI.

When creating a draft, mark all prior `ACTIVE` drafts for the same HTTP-only anonymous session UUID as `ABANDONED` before inserting the new row.

### 9.1 Existing Listing Matching

Recommended matching order:

1. `fsq_place_id`
2. Lowercased email
3. E.164 phone number
4. Normalized name plus `location.postcode` only as a weak fallback

Name plus postcode matching should only be used when `fsq_place_id`, email, and phone are unavailable.

```text
fsq_place_id -> email -> phone
```

If a Foursquare result matches an existing listing:

- Return the existing `vendorListingUuid`.
- Do not overwrite the existing listing with newly returned Foursquare data.
- Set `onboardedToEnvoy` only when `claim_status = 'CLAIMED'`.
- Set `consumerOwned` when the listing is unclaimed and has `owner_user_uuid`.
- Return a consumer-owned/unverified warning when `consumerOwned` is true.

### 9.2 Ranking

Sort order:

1. Existing active, non-superseded listings that match an inferred Foursquare category ID and a postal code in the configured search radius.
2. Within the relevant-existing tier and then within the remaining live-result tier, email present before email absent.
3. Within each group, `date_refreshed` descending.
4. Source relevance order.
5. Name ascending for stable display.

Claim status is not itself a ranking signal. Relevant claimed and unclaimed existing listings receive the same tier boost, and unrelated claimed listings are not included. Take the first eight only after merging, deduplicating, and applying this ordering.

### 9.3 Dedupe

Deduplication keys, in order:

1. `fsq_place_id`
2. Lowercased email
3. E.164 phone number
4. Normalized name plus `location.postcode` only as a weak fallback

`normalized_name` must:

- lowercase
- trim
- collapse repeated whitespace
- remove punctuation
- remove leading `the`
- remove common legal suffixes: `llc`, `inc`, `incorporated`, `co`, `company`, `corp`, `ltd`

Do not over-trust name matching. Only use normalized name plus postcode when stable identifiers and contact keys are unavailable.

If duplicate candidates exist within search ingestion:

- Prefer candidate with newer `date_refreshed`.
- Prefer candidate with richer contact fields.
- Prefer candidate already matched to an existing `vendor_listing`.

Do not force these dedupe rules on manual consumer-created listings. During manual creation, suggest a likely existing listing only when it is vendor-originated or `CLAIMED`; allow the consumer to choose that trusted listing or continue creating a separate consumer-owned listing.

---

## 10. Onboarding Draft Service

Add:

```text
app/services/onboarding_draft_service.ts
```

Responsibilities:

- Generate token.
- Create draft.
- Load active draft by token.
- Load active draft by registered user UUID.
- Load consumed draft by registered user UUID for retry recovery.
- Update recommended and selected vendor listing UUID arrays.
- Associate draft to registered user.
- Mark draft consumed.
- Mark expired drafts.
- Mark prior active drafts for an anonymous session abandoned.

Recommended methods:

```ts
createDraft(input: { projectDescription: string; postalCode: string; anonymousSessionUuid: string }): Promise<{ draft, tokenUuid }>
getActiveDraftByToken(token: string): Promise<AnonymousOnboardingDraft | null>
getActiveDraftByUserUuid(userUuid: string): Promise<AnonymousOnboardingDraft | null>
getConsumedDraftByUserUuid(userUuid: string): Promise<AnonymousOnboardingDraft | null>
updateRecommendations(token: string, vendorSearches: VendorDiscoverySearch[], recommendedVendorListingUuids: string[]): Promise<AnonymousOnboardingDraft>
updateSelection(token: string, selectedVendorListingUuids: string[]): Promise<AnonymousOnboardingDraft>
associateDraftToUser(token: string, userUuid: string): Promise<AnonymousOnboardingDraft>
consumeDraft(token: string, userUuid: string, projectUuid: string): Promise<void>
consumeDraftByUserUuid(userUuid: string, projectUuid: string): Promise<void>
abandonActiveDraftsForAnonymousSession(anonymousSessionUuid: string): Promise<number>
markExpiredDrafts(): Promise<number>
```

Token requirements:

```text
onboarding token = UUID v4
anonymous session id = UUID v4 stored in an HTTP-only server cookie/session
```

Do not use a random opaque string or token hash for this MVP. Store the token in the database as `token_uuid uuid not null unique`.

Expiry:

- `getActiveDraftByToken` and `getActiveDraftByUserUuid` must require `expiresAt > DateTime.utc()`.
- If an otherwise active draft is expired during lookup, mark it `EXPIRED` and return `null`.
- Add an Ace command such as `node ace onboarding:expire-drafts` for scheduled cleanup and analytics consistency.

---

## 11. Registration Changes

### 11.1 Validator

Update `registerValidator`:

```ts
accountType: vine.enum(['consumer', 'vendor']).optional()
onboardingToken: vine.string().uuid({ version: [4] }).optional()
```

Default account type:

```text
consumer
```

### 11.2 Controller

Update `AuthController.register`:

1. Validate request.
2. Resolve entitlement by canonical name.
3. Create user.
4. If account type is vendor, set `vendorApprovalStatus = 'PENDING'`.
5. Auto-login the new user.
6. If consumer and onboarding token is valid, call `associateDraftToUser(token, user.uuid)`, forget `session.onboarding.token`, and redirect to `/onboarding/project`.
7. If consumer and no onboarding token, redirect to `/dashboard`.
8. If vendor, redirect to `/vendor/pending`.

Token source order:

1. Request body `onboardingToken`.
2. `session.get('onboarding.token')`.

Do not read onboarding tokens from query parameters.

### 11.3 Third-Party OAuth

If third-party OAuth sign-up can be used during onboarding, preserve the onboarding token through the OAuth round trip.

Recommended approach:

- Before redirecting to the OAuth provider, the frontend must call `POST /onboarding/registration-handoff` with the UUID v4 onboarding token.
- `registrationHandoff` stores the token in the server-side session under `onboarding.token`.
- The OAuth redirect starts only after the handoff succeeds.
- The OAuth callback reads `session.get('onboarding.token')`.
- Associate the draft to the new or existing user after successful callback.
- Auto-login as currently done.
- Redirect to `/onboarding/project` when valid.

---

## 12. First Project Completion

### 12.1 Controller

Add:

```text
app/controllers/web/onboarding_project_controller.ts
```

Methods:

```ts
show({ auth, inertia, request, response, session })
store({ auth, request, response, session })
```

`show`:

- Requires authenticated consumer.
- Loads active anonymous draft by authenticated user UUID.
- Renders first-project completion page.
- Prefills project description, ZIP/location, and selected vendors resolved from `selectedVendorListingUuids`.

`store`:

- Requires authenticated consumer.
- Calls `getActiveDraftByUserUuid(auth.user.uuid)`.
- If no active draft is found, calls `getConsumedDraftByUserUuid(auth.user.uuid)` and redirects to `/projects/:consumedProjectUuid` when present.
- If the associated draft is expired, renders or redirects to an authenticated expired-draft state instead of returning the user to anonymous intake.
- Validates project fields using existing project rules where possible.
- Resolves selected vendor listing UUIDs; listings were already inserted during discovery.
- Creates user vendor mappings without granting edit authority merely because a listing is available or mapped.
- For each selected ownerless `SEARCH` listing without email, conditionally assigns `owner_user_uuid = auth.user.uuid` if it is still ownerless.
- Creates project.
- Links selected vendors to the project.
- Marks draft consumed.
- Redirects to `/projects/:projectUuid` after the transaction commits so the existing default Convo experience opens.

### 12.2 UI

Add:

```text
inertia/pages/onboarding/project.svelte
```

Use existing project creation UX patterns from:

```text
inertia/pages/home.svelte
inertia/pages/projects/project.svelte
```

Fields:

- Title
- Description
- ZIP/location
- Start date
- End date
- Deadline
- Budget amount
- Budget currency
- Goals
- Selected vendors review

The selected vendor list should be review-only for MVP unless editing is easy.

Expired authenticated draft behavior:

- Show a page or state explaining that the onboarding draft expired.
- Offer actions to start a new project from `/dashboard` or start a fresh vendor search from `/`.
- Do not create a project from an expired draft.
- Do not clear the user's authenticated session.

---

## 13. Vendor Listing Persistence And Ownership

Add to `VendorService` or a new marketplace service:

```ts
insertOrReuseSearchListing(candidate): Promise<VendorListing>
ensureUserVendorMapping(userUuid, vendorListingUuid): Promise<Vendor>
adoptOwnerlessNoEmailSearchListing(userUuid, vendorListingUuid, transaction): Promise<VendorListing>
canEditListing(userUuid, vendorListing): boolean
```

Rules:

- Run `insertOrReuseSearchListing` for every normalized Foursquare result before recommendation ranking.
- Reuse an existing listing by `fsq_place_id`, then lowercased email, then E.164 phone, then normalized name plus postcode only when stable keys are absent.
- Never overwrite or refresh a reused listing.
- New Foursquare listings use immutable `originator = 'SEARCH'` and store email when present plus categories, phone, website, date refreshed, location, and source payload.
- New search listings have `owner_user_uuid = null` and `claim_status = 'UNCLAIMED'`.
- `ensureUserVendorMapping` makes the listing available in a consumer's vendor/project context but does not grant edit access.
- `adoptOwnerlessNoEmailSearchListing` uses a conditional update requiring `originator = 'SEARCH'`, `email is null`, `claim_status <> 'CLAIMED'`, and `owner_user_uuid is null`. The first successful project addition wins ownership; concurrent or later consumers may still add the listing but cannot edit it.
- `canEditListing` allows the claiming vendor when `claim_status = 'CLAIMED'`; otherwise it allows only `owner_user_uuid`.
- Vendor-created listings start vendor-controlled and claimed.
- Consumer-created manual listings use immutable `originator = 'CONSUMER'` and set `owner_user_uuid` to the creator.
- Manual consumer creation does not force deduplication. Suggest likely matches only when the existing listing is vendor-originated or claimed, and allow the consumer to select the trusted existing listing or proceed with a separate listing.
- Claim completion removes consumer edit authority, makes the vendor-controlled listing canonical, and marks matching consumer-controlled duplicates superseded while preserving or migrating project links.

---

## 14. Project Creation And Vendor Linking

Project creation must be idempotent and must not create multiple projects if the user double-submits the completion form.

Recommended sequence inside one database transaction:

1. Lock the user's active onboarding draft row with `for update`.
2. Validate project details.
3. Resolve `selected_vendor_listing_uuids` to active listings and canonical replacements.
4. Conditionally assign the consumer as owner of selected ownerless, no-email `SEARCH` listings.
5. Ensure user vendor mappings without changing edit authority for other listing types.
6. Create project.
7. Create project-vendor mappings.
8. Set draft status to `CONSUMED`.
9. Set `consumed_by_user_uuid` and `consumed_project_uuid`.
10. Commit transaction.
11. Redirect to `/projects/:projectUuid`.

At the start of `store`, call `getActiveDraftByUserUuid(auth.user.uuid)`. If it returns `null`, call `getConsumedDraftByUserUuid(auth.user.uuid)`. That secondary query must look for `status = 'CONSUMED'`, `registered_user_uuid = auth.user.uuid`, and a populated `consumed_project_uuid`. If found, redirect to `/projects/:consumedProjectUuid` instead of creating a second project. If a consumed draft exists without a project UUID, return a recovery error and log it.

Do not hold a transaction open around OpenAI or external calls. Project completion performs no OpenAI or outreach work.

---

## 15. Project Conversation Handoff

Project completion redirects directly to:

```text
/projects/:projectUuid
```

The existing project page opens its established default Convo experience. Do not add an outreach-preparing page, do not call an initial outreach preparation endpoint, and do not automatically create outreach drafts during onboarding.

The project conversation can gather additional project context before the existing user- or agent-initiated outreach flow is used. Gathering missing vendor email or other vendor contact details through the agent is out of scope for this phase.

---

## 16. Vendor Registration Skeleton

### 16.1 Registration UI

Update:

```text
inertia/pages/auth/register.svelte
```

Add radio/segmented control:

```text
I am planning a project
I am a pro/vendor
```

Default:

- `consumer`

Preselect vendor when:

```text
?accountType=vendor
```

Preselect consumer and preserve onboarding token when:

```text
registration is reached after POST /onboarding/registration-handoff
```

Do not put the raw onboarding token in the URL. The registration page receives only `accountType` through query params and reads no token directly. The registration form includes the token from localStorage in the POST body when available; otherwise the server can use `session.get('onboarding.token')`.

### 16.2 Pending Vendor Page

Add:

```text
inertia/pages/vendors/pending.svelte
app/controllers/web/vendor_onboarding_controller.ts
```

Route:

```ts
router.get('/vendor/pending', [VendorOnboardingController, 'pending']).middleware(middleware.auth())
```

Behavior:

- Only vendor users should see it.
- Consumers should redirect to dashboard.
- Approved vendors should redirect to listing page.

Vendor listing management is later phase.

---

## 17. Middleware And Authorization

Recommended helpers:

```ts
isConsumer(user): boolean
isVendor(user): boolean
isApprovedVendor(user): boolean
isOnboardedListing(listing): boolean // claimStatus === 'CLAIMED'
canEditVendorListing(user, listing): boolean
```

Avoid checking entitlement IDs directly.

Potential middleware later:

```text
consumerAuth
vendorAuth
approvedVendorAuth
```

MVP can keep checks inside controllers if scope is small.

Every vendor listing mutation must call the same authorization rule:

- If `claim_status = 'CLAIMED'`, only `claimed_by_user_uuid` may update it.
- Otherwise, only `owner_user_uuid` may update it.
- A user/vendor mapping, project-vendor mapping, or general marketplace availability does not grant edit access.
- Ownerless listings are read-only to consumers.
- Superseded listings cannot be edited or newly added; resolve them to their canonical replacement.

---

## 18. Frontend Storage

Server draft is canonical.

Browser may store:

```text
envoy_seen=true
envoy_onboarding_token=<uuid-v4-token>
```

Recommended:

- Store the raw onboarding token in localStorage because Svelte must include it in anonymous API request bodies.
- Store `envoy_seen=true` only after a successful vendor-search response.
- Clear `envoy_onboarding_token` after draft consumption, expiry, or explicit restart.
- Clear stale localStorage state when the server says the draft is expired or missing.

Do not store Foursquare raw payloads only in localStorage. The server-side draft remains canonical.

The server must also set an HTTP-only anonymous onboarding session cookie. That cookie, not localStorage, is the source of truth for grouping multiple anonymous drafts from the same browser/device for supersession and abandonment analytics.

---

## 19. Environment And Config

Project-management:

```text
FOURSQUARE_PLACES_API_KEY
REASONING_ENGINE_URL
```

Reasoning-engine:

```text
OPENAI_API_KEY
```

Docker/local:

- Update `.env.example` if needed.
- Update docker-compose env wiring if needed.

---

## 20. Testing Strategy

### 20.1 Project-Management Unit/Functional Tests

Cover:

- Entitlement migration result.
- Registration auto-login.
- Registration default account type is consumer.
- Vendor registration sets pending status.
- Consumer registration with onboarding token redirects to project completion.
- Third-party OAuth registration calls registration handoff before provider redirect.
- OAuth callback associates the session-stored onboarding token to the authenticated user.
- Anonymous draft creation.
- HTTP-only anonymous session cookie is created for intake users.
- Prior active drafts for the same HTTP-only anonymous session are marked abandoned when a new draft is created.
- Clearing localStorage but keeping the anonymous session cookie still allows a new draft to abandon prior active drafts.
- Draft token is UUID v4.
- Draft lookup by UUID v4 token.
- Lazy draft expiration during lookup.
- Expire-drafts cleanup command.
- No-email Foursquare results remain eligible and fill remaining recommendation slots.
- Vendor selection update.
- Vendor selection rejects more than 8 candidates.
- Vendor selection stores listing UUIDs and accepts listings without email.
- Vendor search classification is capped at 4.
- Foursquare candidate normalization.
- Every normalized Foursquare candidate is inserted or reuses a listing before recommendations are returned.
- Existing search listings are not refreshed or overwritten.
- Relevant existing listings rank before live results regardless of claim status.
- Unrelated claimed listings receive no ranking boost.
- Within each result tier, email-bearing listings rank before no-email listings.
- Recommendation response is capped at 8 after relevant-existing-first ranking and email-first ordering within each tier.
- Newer `date_refreshed` ranks before older `date_refreshed`.
- Dedupe by `fsq_place_id`.
- Dedupe by email.
- Dedupe by E.164 phone number.
- Normalized-name-plus-postcode dedupe applies only when stable IDs/contact keys are unavailable.
- Vendor listing upsert from Foursquare candidate.
- Search-originated vendor originator uses `SEARCH`.
- Manual consumer vendor originator uses `CONSUMER`.
- `onboardedToEnvoy` is true only for `claim_status = 'CLAIMED'`.
- Consumer-owned listings return an unverified ownership warning.
- Manual consumer creation suggests vendor-originated or claimed matches without forcing reuse.
- Claimed listing edits are restricted to the claiming vendor.
- Unclaimed consumer-controlled listing edits are restricted to `owner_user_uuid`.
- User/project mappings alone do not grant edit access.
- Ownerless email-bearing search listings remain consumer-immutable.
- First project addition atomically adopts an ownerless no-email search listing without changing `originator`.
- Concurrent additions cannot assign multiple owners.
- Claim canonicalization supersedes matching consumer-controlled duplicates while preserving project links.
- Project creation from onboarding draft.
- Double-submit project completion does not create a duplicate project.
- Double-submit project completion after the first transaction commits uses `getConsumedDraftByUserUuid` to redirect to the consumed project.
- Project completion loads draft by registered user UUID without token.
- Project-vendor linking.
- Draft marked consumed after project creation.
- Project completion redirects to `/projects/:projectUuid` after the transaction commits.
- Project completion does not create outreach drafts or call an outreach preparation endpoint.
- Anonymous expired draft cannot create project.
- Authenticated expired draft cannot create project and shows authenticated recovery actions.

### 20.2 Reasoning-Engine Tests

Cover:

- Vendor discovery request validation.
- Prompt includes the project description and does not require ZIP/postal code.
- Prompt instructs strict JSON.
- Output parsing.
- Invalid JSON handling.
- Maximum vendor search limit of 4.
- Duplicate or near-duplicate search queries are dropped.

Project-management Foursquare client tests should also verify that ZIP/postal code is sent as
`near` and that no explicit `fields` parameter is added.

### 20.3 Integration Tests

Happy path:

```text
anonymous intake -> reasoning vendor searches -> relevant existing listings merged with persisted Foursquare results -> relevant-existing-first recommendations -> select listing UUIDs -> register -> auto-login -> project completion -> project created -> vendors linked -> user sees project Convo
```

Failure scenarios:

1. Reasoning-engine unavailable.
2. Foursquare unavailable.
3. No vendors found.
4. Draft expires before registration.
5. Draft expires after registration but before project completion.
6. Selected Foursquare vendor already exists by `fsq_place_id`.
7. Selected Foursquare vendor already exists by email.
8. Selected Foursquare vendor already exists by E.164 phone number.
9. Vendor account attempts to access consumer project completion.
10. Consumer account attempts to access vendor pending page.
11. User double-submits project completion.
12. Foursquare returns only results without email.
13. Two consumers concurrently add the same ownerless no-email search listing.
14. A non-owner attempts to edit a consumer-controlled listing.
15. A consumer attempts to edit a claimed or ownerless search listing.

### 20.4 UI Tests

Use Playwright for:

- Anonymous root intake visible for new visitor.
- Anonymous visitor with a stale onboarding token gets a blank intake, not a login redirect.
- Anonymous visitor with a valid onboarding token resumes the draft.
- `envoy_seen` is set only after vendor results are returned.
- Vendor CTA preselects vendor registration.
- Vendor recommendations can be selected.
- Vendor recommendation selection enforces the max selection count.
- Vendors without email appear after vendors with email and remain selectable.
- Recommendation UI shows claimed/onboarded and consumer-owned/unverified states accurately.
- Registration auto-login redirects correctly.
- Project completion form is prefilled.
- Project creation redirects to the project page and opens the default Convo experience.

---

## 21. Rollout Plan

### Step 1: Data Foundation

- Add entitlement migration.
- Add vendor listing ownership, claim, nullable email, and supersession fields.
- Add anonymous onboarding draft table with recommended and selected listing UUID arrays.
- Update models.

### Step 2: Registration And Routing

- Update root controller behavior.
- Add account type UI.
- Add auto-login registration.
- Add vendor pending page.

### Step 3: Draft Persistence

- Add draft service.
- Add vendor search and selection endpoints.
- Add token handling.

### Step 4: Reasoning-Engine Vendor Discovery

- Add request/response contract.
- Add prompt and validation.
- Add project-management client method.

### Step 5: Foursquare Search And Recommendations

- Complete `vendor_search_service`.
- Add Foursquare candidate normalization.
- Insert or reuse listings for every normalized result without refreshes.
- Merge relevant existing listings with live results, rank relevant existing listings first regardless of claim status, apply email-first ordering within each tier, dedupe, and cap recommendations at eight.
- Render recommendation UI.

### Step 6: Project Completion

- Add onboarding project page.
- Resolve selected listing UUIDs from draft.
- Attach vendors to project.
- Adopt ownerless no-email search listings when first added.
- Mark draft consumed.
- Redirect to the default project Convo experience.

### Step 7: Ownership And Availability

- Make active, non-superseded listings available to all consumers for project addition.
- Enforce claimed-vendor and consumer-owner edit authorization.
- Add consumer-owned/unverified UI warnings.
- Suggest trusted existing listings during manual creation without forcing deduplication.

---

## 22. Open Follow-Up For Later Vendor Claiming

This feature prepares data fields for future vendor claiming. Confirmed claim behavior is:

- `claim_status = 'CLAIMED'` is the sole definition of onboarded to Envoy.
- The claiming vendor receives exclusive edit authority.
- A claimed listing becomes canonical.
- Matching consumer-controlled duplicates are superseded while project references remain valid or are migrated.

Later work must still decide:

- Exact business verification flow.
- How Envoy receives verification success.
- Whether verification can auto-approve.
- The operational/manual process for conflicts if multiple accounts attempt to claim the same business.
- Whether support/admin tooling is needed for disputed claims.

For MVP, a single approved vendor account can claim one business later, and unapproved vendors remain blocked.
