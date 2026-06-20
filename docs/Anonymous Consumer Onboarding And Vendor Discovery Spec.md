# Anonymous Consumer Onboarding And Vendor Discovery Specification

## 1. Executive Summary

Envoy currently routes public visitors to a simple landing page with login and registration calls to action. After registration or login, users land on the dashboard and can create a project through the existing project creation flow.

This feature changes the first-time consumer experience into a guided project intake and vendor discovery flow. Anonymous consumers describe their project, provide a ZIP code, review recommended vendors returned from Foursquare, select vendors they like, register, complete the first project details, and then continue into the project's default Convo experience.

The same public entry point also gives vendors a clear "For pros" path into registration. Vendor onboarding and business verification are intentionally split into a later phase, but the data model should be prepared for future claimed listings.

Two documents define this feature:

- This document: product flow, architecture, scope, and decisions.
- `Anonymous Consumer Onboarding And Vendor Discovery Implementation Spec.md`: concrete implementation plan, migrations, routes, payloads, services, and tests.

---

## 2. Current System Context

### 2.1 Product App

The primary application is `envoy-project-management`.

Stack:

- AdonisJS 6
- Lucid ORM
- Postgres
- Inertia
- Svelte 5
- Tailwind CSS
- Skeleton UI
- Session-based web auth

Relevant current behavior:

- `/` renders `inertia/pages/landing.svelte`.
- `/login` and `/register` are guest-only auth routes.
- Registration currently creates a user and redirects to login.
- Login redirects to `/dashboard` unless an intended URL exists.
- `/dashboard` renders `inertia/pages/home.svelte`.
- `home.svelte` contains the existing authenticated new-project wizard and persists its draft in browser localStorage.
- Projects are created through `/projects` using `ProjectsController.store`.
- Vendors are represented by a global `vendor_listings` table and user-specific `vendors` mappings.
- Outreach drafts already exist through `project_outreach_service` and the project Outreach tab.
- `app/services/vendor_search_service.ts` already contains the Foursquare Places SDK integration.

### 2.2 Reasoning Engine

The AI service is `reasoning-engine`.

Stack:

- Express
- TypeScript
- OpenAI Responses API
- TypeORM
- Postgres

Relevant current behavior:

- Project-management calls the reasoning-engine HTTP endpoint.
- Reasoning-engine handles topic/action selection and response drafting.
- Project-management owns project, vendor, conversation, outreach, and insight persistence.
- Existing reasoning context supports project context, recent turns, and project insights.

---

## 3. Goals

1. Make the root public experience useful before registration.
2. Let anonymous consumers describe a project and enter a ZIP code.
3. Use the reasoning-engine to infer up to four relevant vendor search classifications and Foursquare search queries.
4. Use project-management to call Foursquare through the existing vendor search service.
5. Show up to eight Foursquare vendor results, prioritizing vendors with email while retaining high-ranking vendors without email when needed to fill the result set.
6. Persist every normalized Foursquare result as a global `vendor_listing`, then store recommended and selected listing UUIDs on the anonymous draft for 24 hours.
7. Let consumers register and auto-login.
8. After registration, send onboarding users directly to a first-project completion screen with project details prefilled.
9. Create the project only after the user finishes the details form.
10. Preserve listing origin and enforce claim-aware, single-owner edit authorization.
11. Attach selected vendors to the project, assigning consumer ownership only when an ownerless search listing without email is first added to a project.
12. Route the user to the created project's default Convo page.
13. Let the established project conversation gather more project context before any later outreach drafting workflow.
14. Add a vendor registration path, role, and placeholder verification status without building full vendor verification in MVP.

---

## 4. Non-Goals

The MVP does not include:

- Full vendor onboarding and business verification.
- Admin review workflows.
- Multiple vendor users managing one business.
- A manually maintained vendor category taxonomy.
- A second enrichment service to retrieve vendor emails.
- Vendor website scraping.
- Long-lived anonymous accounts.
- Creating project records before registration is complete.
- Storing vendor-discovery data as project insights.
- Automatically refreshing Foursquare-originated listing data after its initial insertion.
- Automatically creating outreach drafts immediately after onboarding project creation.
- Anonymous rate limiting inside the application beyond existing WAF controls.

---

## 5. Core Product Decisions

### 5.1 Root Route

Use `/` as the public anonymous consumer intake route.

Behavior:

| Visitor State | Behavior |
| --- | --- |
| Anonymous, no prior site marker | Show consumer project intake. |
| Anonymous, valid onboarding token exists | Resume the anonymous onboarding draft at the latest completed step. |
| Anonymous, prior site marker exists and no valid onboarding token exists | Clear stale onboarding browser flags and show a blank consumer intake. |
| Authenticated consumer | Route to dashboard. |
| Authenticated vendor, approved | Route to vendor listing page. |
| Authenticated vendor, pending approval | Route to pending verification page. |

The prior site marker should be a lightweight browser flag such as `envoy_seen=true`. Set it only after the visitor submits the intake form and receives vendor results, not on first page load. A visitor who only views the page and leaves should still see the intake on return.

Because the onboarding token is stored in localStorage, the anonymous resume-or-login decision must happen client-side after the page checks localStorage and validates the token with project-management. The server may redirect authenticated users from `/`, but it should not redirect anonymous users to login before the client has a chance to restore a valid draft.

If the client finds an expired, missing, or invalid onboarding token, it should clear `envoy_onboarding_token` and `envoy_seen`, then show the blank intake again. A stale anonymous draft must not force the user to `/login`.

### 5.2 Vendor CTA

The public intake page includes a vendor-oriented CTA such as:

```text
For pros
```

It routes to:

```http
GET /register?accountType=vendor
```

The registration page preselects the vendor account type.

### 5.3 Registration Auto-Login

All successful registration paths should auto-login.

Default behavior:

- Consumer registration with no onboarding draft goes to `/dashboard`.
- Consumer registration with an onboarding draft goes to the first-project completion screen.
- Vendor registration goes to vendor verification or pending approval flow.

### 5.4 Roles

Rename the existing `USER` entitlement to `CONSUMER`.

Add a new `VENDOR` entitlement.

Accounts are role-exclusive for MVP:

- Consumers can create projects and contact vendors.
- Vendors manage their own listing only after approval.

### 5.5 Anonymous Draft Persistence

Use a server-side anonymous onboarding draft keyed by an onboarding token. The onboarding token must be a UUID v4.

Browser responsibilities:

- Store the UUID v4 onboarding token in localStorage under a fixed key such as `envoy_onboarding_token`.
- Optionally keep a local fallback copy of the form state.
- Send the token in body payloads for anonymous onboarding API calls.
- Clear the token after the draft is consumed, expired, or abandoned.

Server responsibilities:

- Store the canonical anonymous draft.
- Set and maintain an HTTP-only anonymous session cookie that contains or maps to an anonymous browser/session UUID.
- Enforce 24-hour expiration when loading drafts.
- Mark older active drafts for the same anonymous session cookie as `ABANDONED` when a new draft is created.
- Associate the active draft with the newly registered user after successful registration.
- Load the post-registration project completion draft by authenticated user UUID, not by raw token.
- Mark it consumed atomically with successful project creation.

The HTTP-only anonymous session cookie is the server-side key for draft supersession and abandonment analytics. LocalStorage alone is not sufficient because it can be cleared or unavailable in a new/incognito browser context. Drafts that lose their anonymous session linkage are still expired by the 24-hour cleanup path.

The raw token must not be placed in URLs. In particular, registration should not use `?onboardingToken=<token>`.

When the anonymous user clicks the registration CTA, the frontend may submit the token in the registration request body. If an intermediate redirect is needed, first store the token in the anonymous Adonis session through a POST endpoint, then redirect to `/register?accountType=consumer`.

Before any third-party OAuth/social sign-up redirect, the frontend must call the same server-side handoff endpoint to bind the onboarding token to the anonymous/auth session. OAuth callbacks must read the token from the server session and associate the draft to the authenticated user before redirecting.

### 5.6 Vendor Listing Availability, Ownership, And Claims

Every normalized Foursquare result is inserted or matched to a global `vendor_listing` during discovery, before the user selects vendors. Listing `originator` is immutable provenance and remains one of `CONSUMER`, `SEARCH`, or `VENDOR`.

All active, non-superseded listings are available for any consumer to add to a project. Availability does not grant edit permission.

Edit authority is:

- A listing is "onboarded to Envoy" only when `claim_status = 'CLAIMED'`.
- A claimed listing is controlled exclusively by its claiming vendor.
- An unclaimed `CONSUMER` listing is controlled exclusively by the consumer recorded as its owner.
- An unclaimed `SEARCH` listing with email is ownerless and cannot be edited by consumers.
- An unclaimed `SEARCH` listing without email starts ownerless. The first consumer who adds it to a project becomes its owner and may edit it until a vendor claims it. Its `originator` remains `SEARCH`.
- No automatic Foursquare refresh overwrites listing data after insertion.

Consumer-owned listings must display a clear risk indicator in recommendation and selection UI because the business has not been verified by the vendor.

Manual consumer vendor creation does not force deduplication. When a likely existing listing is vendor-originated or `CLAIMED`, Envoy should offer it as an alternative; the consumer may select it or proceed with creating a separate consumer-owned listing.

Future claiming flow:

1. Vendor verifies business ownership.
2. Envoy matches by `fsq_place_id` first, then email, domain, or phone.
3. The claimed listing becomes canonical and exclusively vendor-controlled.
4. Matching consumer-controlled duplicates are marked superseded by the canonical claimed listing while existing project references remain valid or are migrated transactionally.
5. Conflicts are blocked for manual resolution later.

---

## 6. Consumer End-To-End Flow

```text
Anonymous visitor
  |
  v
/ public intake page
  - project blurb
  - ZIP code
  |
  v
Project-management creates anonymous onboarding draft
  |
  v
Project-management calls reasoning-engine
  - infer up to four vendor search classifications
  - produce Foursquare search queries
  |
  v
Project-management calls Foursquare through vendor_search_service
  |
  v
Project-management inserts or reuses vendor_listings for every normalized result
  - draft stores recommended vendor listing UUIDs only
  |
  v
Top recommendation list
  - up to eight results
  - results with email first, then results without email
  - each email group sorted by date_refreshed desc, then Foursquare relevance
  - "Onboarded to Envoy" only when claim_status = CLAIMED
  - consumer-owned listings show an unverified ownership warning
  |
  v
Consumer selects vendors
  - max 8 vendors
  |
  v
Draft is updated with selected vendor listing UUIDs
  |
  v
Consumer registers and is auto-logged in
  - draft is associated to the new user
  |
  v
First-project completion screen
  - prefilled description
  - ZIP/location
  - selected vendors
  - asks for remaining project details
  |
  v
Consumer submits final project details
  |
  v
Project-management:
  - creates project
  - creates user vendor mappings
  - creates project_vendor rows
  - assigns ownership when an ownerless, email-less SEARCH listing is first added
  |
  v
Project page default Convo experience
```

---

## 7. Public Intake UX

The first screen should be the actual project intake, not a marketing landing page.

Required fields:

- Project blurb
- ZIP code

Recommended validation:

- Project blurb: required, min 20 characters, max 2,000 characters.
- ZIP code: required, permissive postal-code string. Do not hard-limit to US-only formats.

Primary action:

```text
Find vendors
```

Secondary action:

```text
For pros
```

Results state should show:

- Vendor name
- Location/address
- Onboarded to Envoy flag only when `claim_status = 'CLAIMED'`
- Consumer-owned/unverified warning when an unclaimed listing has a consumer owner
- Categories returned by Foursquare

The UI should not display email, phone number, website, `date_refreshed`, or raw Foursquare/source metadata in the recommendation list. Those fields should still be stored when available for dedupe, project creation, and outreach.

Selection behavior:

- Consumer can select one to eight vendors.
- Selected vendor listing UUIDs persist to the anonymous onboarding draft.
- Continue action sends the user to registration.
- Continue action must not put the onboarding token in the registration URL.
- Results without email remain selectable and appear after results with email.

---

## 8. Vendor Discovery Architecture

### 8.1 Responsibility Split

Reasoning-engine:

- Receives project blurb and ZIP code.
- Infers up to four vendor search classifications.
- Produces Foursquare search queries for those classifications.
- Returns structured JSON only.

Project-management:

- Owns anonymous draft persistence.
- Calls reasoning-engine for classification/query generation.
- Calls Foursquare through `vendor_search_service`.
- Normalizes Foursquare results into vendor candidates.
- Inserts or reuses `vendor_listings` for every normalized search result.
- Stores recommended and selected vendor listing UUIDs on the draft instead of vendor payloads.
- Creates the project, user vendor mappings, and project-vendor mappings after registration.
- Routes the completed project to its default Convo experience.

### 8.2 Why Project-Management Calls Foursquare

Project-management should call Foursquare directly because:

- It owns vendor persistence.
- It owns dedupe and source priority rules.
- It owns anonymous draft state.
- It can keep external API integration separate from reasoning topic/action selection.

---

## 9. Vendor Result Priority And Deduplication

Return at most eight recommendations. Priority should be:

1. Results with email before results without email.
2. Within each email-presence group, `date_refreshed` descending.
3. Foursquare relevance order.
4. Name ascending for stable ordering.

For example, if five eligible results have email and five do not, return all five with email followed by the top three without email.

Deduplication:

- Primary key: `fsq_place_id` when available.
- Secondary keys: lowercased email, E.164 phone number.
- Weak fallback key: normalized name plus postcode.

`normalized_name` should lowercase, trim, collapse whitespace, remove punctuation, remove leading `the`, and remove common legal suffixes: `llc`, `inc`, `incorporated`, `co`, `company`, `corp`, `ltd`.

Name plus postcode matching is a weak fallback. Use it only when `fsq_place_id`, email, and phone are unavailable.

If a Foursquare result matches an existing Envoy listing, reuse the existing listing without overwriting it. `onboardedToEnvoy` is true only when the reused listing has `claim_status = 'CLAIMED'`. If multiple search candidates refer to the same business before persistence, prefer the record with the most complete contact fields and newest `date_refreshed`.

These dedupe rules apply to search ingestion. Manual consumer-created vendors are not forcibly deduplicated. The manual creation UI may suggest only vendor-originated or claimed listings as trusted alternatives while still allowing a separate consumer-owned listing.

---

## 10. Vendor Listing Data Model Direction

`vendor_listings` stores every normalized Foursquare result during discovery so recommendations and selections can reference canonical listing UUIDs.

Required additions:

- `originator = 'SEARCH'`
- `fsq_place_id`
- `categories` as a string array of human-readable category labels
- `phone_number` as an E.164 string
- `website` as a string
- `date_refreshed` as a date
- `location` as a JSON object
- `owner_user_uuid` for exclusive consumer edit authority while unclaimed
- `superseded_by_vendor_listing_uuid` for claim-time canonicalization

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

Foursquare categories are stored as human-readable listing data. No separate vendor type storage strategy is needed for MVP.

`email` must be nullable because search results without email are retained. Search ingestion does not refresh or overwrite an existing listing. Ownership and edit authorization are derived from `claim_status`, `claimed_by_user_uuid`, and `owner_user_uuid`; `originator` remains source provenance.

---

## 11. Project Creation Handoff

After registration, the user should land on a dedicated first-project completion screen, not the generic dashboard.

The post-registration handoff must be user-associated. During registration, project-management validates the onboarding token from the request body or anonymous session, associates the active draft to the new user, and redirects to `/onboarding/project`. `OnboardingProjectController.show` and `store` then load the active draft by authenticated user UUID. They should not require or accept the raw token after login.

The screen should prefill:

- Description from the project blurb.
- ZIP/location from intake.
- Selected vendors resolved from the draft's selected vendor listing UUIDs.

The user completes any remaining required project fields according to the current project model and validators.

The project record should be created only after final submission.

Project creation must be idempotent. The draft status transition to `CONSUMED`, project creation, ownership adoption where applicable, user vendor mappings, and project-vendor mappings must happen in one database transaction. The transaction should lock the active draft row and update it from `ACTIVE` to `CONSUMED` only once.

`OnboardingProjectController.store` must have an explicit consumed-draft recovery path. It should first load the active draft by authenticated user UUID. If no active draft is returned, it must query for a `CONSUMED` draft with `registered_user_uuid = auth.user.uuid` and a populated `consumed_project_uuid`. If found, route the user to the existing project page for that project instead of treating the request as missing or expired. This covers retries and double-submits that arrive after the original transaction has already committed. A double-submit against the same draft must return the already-created project path or a clear already-consumed response; it must not create a second project.

---

## 12. Post-Creation Conversation Handoff

After the user submits the first-project completion form:

1. Selected vendors are linked to the project inside the project creation transaction.
2. Any selected, ownerless `SEARCH` listing without email is atomically assigned to the creating consumer if it is still ownerless.
3. The transaction commits the project, vendor links, ownership changes, and consumed draft state.
4. Envoy routes the user directly to `/projects/:projectUuid`.
5. The project page opens its established default Convo experience.

No outreach-preparing page or initial outreach preparation endpoint is part of onboarding. No outreach drafts are automatically created at project completion. The existing project conversation should gather additional project context before a later user- or agent-initiated outreach workflow. Having the agent gather missing vendor contact details is explicitly out of scope for this phase.

---

## 13. Vendor Onboarding Later Phase

MVP prepares for, but does not fully implement, vendor onboarding.

Planned vendor flow:

```text
Vendor clicks "For pros"
  |
  v
/register?accountType=vendor
  |
  v
Vendor account is created with VENDOR entitlement
  |
  v
Business ownership verification
  |
  v
Pending approval / blocked state until approved
  |
  v
Vendor listing management page
```

Vendor users are blocked until approval.

Once approved and the listing has `claim_status = 'CLAIMED'`, the claiming vendor exclusively controls the canonical listing. Claiming supersedes consumer edit authority.

---

## 14. Data Ownership

Project-management owns:

- Anonymous onboarding drafts.
- Vendor listings.
- User vendor mappings.
- Project vendor mappings.
- Projects.
- Vendor claim fields.
- Vendor listing ownership and edit authorization.
- Account roles.
- Foursquare integration through `vendor_search_service`.

Reasoning-engine owns:

- LLM prompt and response contract for vendor search classification.
- Query generation for Foursquare search.

Foursquare owns:

- Search result data returned by the Foursquare Places API.

---

## 15. Analytics And Logging

The system may log anonymous project blurbs and vendor searches for analytics and debugging.

Recommended events:

- Anonymous intake submitted.
- Vendor search classifications inferred.
- Foursquare search completed.
- Vendor results shown.
- Vendor selected.
- Registration started from onboarding.
- Registration completed from onboarding.
- First project created from onboarding.
- Ownerless search listing adopted by a consumer project.

Logs should avoid storing secrets, auth tokens, API keys, or unnecessary browser identifiers.

---

## 16. Failure Handling

### 16.1 Reasoning-Engine Fails

Show a retryable error.

Do not register the user or create a project.

### 16.2 Foursquare Fails

Show a retryable error.

If cached or existing matching `vendor_listings` are available, the UI may show those results with an indication that live search is unavailable.

### 16.3 Anonymous Draft Expires

Show a friendly restart state and route the user back to the intake.

Draft expiry should be enforced lazily on every draft lookup by requiring `status = ACTIVE` and `expires_at > now()`. A cleanup command or scheduled job should later mark stale active drafts as `EXPIRED` for analytics and storage hygiene.

If an authenticated user's associated onboarding draft expires before project completion, do not send the user back to the anonymous intake. Show an authenticated expired-draft state with actions to start a new project from the dashboard or start a fresh vendor search.

### 16.4 No Vendors Found

Vendors without email are valid recommendations and must not trigger an empty state. Show the no-vendors-found state only when no usable Foursquare results or existing listings can be returned:

- Explain that Envoy could not find vendors for the current description and ZIP code.
- Let the user edit the project description or ZIP code and retry.
- Do not proceed to registration from an empty recommendation list.

### 16.5 Selected Vendor Becomes Invalid

Resolve selected listing UUIDs at project creation. Skip missing, inactive, or superseded listings only when they cannot be safely remapped to a canonical listing, and show a partial-success warning. Missing email is not invalid.

### 16.6 Project Conversation Navigation Fails

Keep the committed project and vendor links. Return the canonical `/projects/:projectUuid` destination so the client can retry navigation without repeating project creation.

---

## 17. Phased Delivery

### Phase 1: Consumer Intake Foundation

- Replace root anonymous landing with project blurb and ZIP intake.
- Add returning logged-out routing behavior.
- Add account-type registration UI.
- Auto-login after registration.
- Add `CONSUMER` and `VENDOR` entitlements.

### Phase 2: Anonymous Drafts

- Add server-side anonymous onboarding draft storage.
- Add token-based draft handoff.
- Add 24-hour expiration.
- Add draft supersession so new drafts abandon older active drafts for the same HTTP-only anonymous session.
- Associate the draft to the registered user and load project completion by user UUID.
- Add draft consumption after project creation.

### Phase 3: Foursquare Vendor Discovery

- Add reasoning-engine vendor search classification contract.
- Add project-management service to call reasoning-engine.
- Use existing `vendor_search_service` for Foursquare calls.
- Limit inferred vendor types/classifications to 4.
- Normalize Foursquare results.
- Insert or reuse a `vendor_listing` for every normalized result.
- Rank email-bearing results first, then results without email.
- Return at most eight recommendations while retaining no-email results when needed.
- Store recommended and selected vendor listing UUID arrays on the onboarding draft.
- Merge, rank, and dedupe search-originated recommendations without forcing dedupe on manual consumer listings.

### Phase 4: First Project Completion

- Add onboarding project completion screen.
- Prefill from anonymous draft.
- Create project after final submit.
- Create user vendor mappings from selected listing UUIDs.
- Attach vendors to project.
- Atomically assign consumer ownership when an ownerless, email-less search listing is first added to a project.
- Redirect to the project page's default Convo experience.

### Phase 5: Listing Ownership And Availability

- Make active, non-superseded listings available for any consumer to add to a project.
- Enforce exclusive consumer-owner edits for unclaimed consumer-controlled listings.
- Enforce exclusive vendor edits for claimed listings.
- Keep email-bearing search listings consumer-immutable until claimed.
- Add consumer-owned/unverified risk indicators.
- Suggest trusted existing listings during manual consumer creation without forcing deduplication.

### Phase 6: Vendor Onboarding

- Add vendor verification and approval flow.
- Add vendor listing management page.
- Implement listing claim flow.

---

## 18. MVP Recommendation

Build the consumer flow first.

The first shippable MVP should include:

- Root anonymous intake.
- Reasoning-engine vendor search classification and Foursquare query generation.
- Foursquare recommendations through `vendor_search_service`.
- Anonymous draft persistence for 24 hours.
- Registration auto-login.
- First-project completion from draft.
- Vendor listing creation for every normalized Foursquare result with `originator = 'SEARCH'`.
- UUID-only recommendation and selection references in the onboarding draft.
- Project-vendor attachment.
- Claim-aware ownership and edit authorization.
- Default project Convo handoff after project creation.

Vendor onboarding should be prepared in the data model and registration role selection, but full verification and claim management should ship after the consumer path is stable.
