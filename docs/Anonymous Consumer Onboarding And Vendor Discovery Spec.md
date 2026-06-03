# Anonymous Consumer Onboarding And Vendor Discovery Specification

## 1. Executive Summary

Envoy currently routes public visitors to a simple landing page with login and registration calls to action. After registration or login, users land on the dashboard and can create a project through the existing project creation flow.

This feature changes the first-time consumer experience into a guided project intake and vendor discovery flow. Anonymous consumers describe their project, provide a ZIP code, review recommended vendors, select vendors they like, register, complete the first project details, and then review automatically drafted vendor outreach messages.

The same public entry point also gives vendors a clear "For pros" path into registration. Vendor onboarding and Google business verification are intentionally split into a later phase, but the data model should be prepared for claimed Google listings.

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
3. Use the reasoning-engine to infer relevant vendor types and Google Places search queries.
4. Use project-management to fetch matching Envoy vendor listings and Google Places vendors.
5. Prioritize Envoy vendors above external Google vendors.
6. Show a merged, deduped vendor recommendation list.
7. Persist the anonymous project blurb, ZIP code, inferred vendor types, Google queries, and selected vendors for 24 hours.
8. Let consumers register and auto-login.
9. After registration, send onboarding users directly to a first-project completion screen with project details prefilled.
10. Create the project only after the user finishes the details form.
11. Convert selected Google vendors into `vendor_listings` when the first project is created.
12. Attach selected vendors to the project.
13. Automatically create initial outreach drafts for selected vendors.
14. Send the user to a review surface for those drafts immediately after project creation.
15. Add a vendor registration path, role, and placeholder verification status without building full vendor verification in MVP.

---

## 4. Non-Goals

The MVP does not include:

- Full vendor onboarding and Google business verification.
- Admin review workflows.
- Multiple vendor users managing one business.
- A category reference table or managed taxonomy.
- Detailed Google review import.
- Vendor email discovery or website scraping.
- Long-lived anonymous accounts.
- Creating project records before registration is complete.
- Storing vendor-discovery data as project insights.
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

Use a server-side anonymous onboarding draft keyed by an opaque token.

Browser responsibilities:

- Store the opaque token in localStorage under a fixed key such as `envoy_onboarding_token`.
- Optionally keep a local fallback copy of the form state.
- Send the token in body payloads for anonymous onboarding API calls.
- Clear the token after the draft is consumed, expired, or abandoned.

Server responsibilities:

- Store the canonical anonymous draft.
- Enforce 24-hour expiration when loading drafts.
- Mark older active drafts for the same browser/session as `ABANDONED` when a new draft is created.
- Associate the active draft with the newly registered user after successful registration.
- Load the post-registration project completion draft by authenticated user UUID, not by raw token.
- Mark it consumed after successful project creation.

The raw token must not be placed in URLs. In particular, registration should not use `?onboardingToken=<token>`.

When the anonymous user clicks the registration CTA, the frontend may submit the token in the registration request body. If an intermediate redirect is needed, first store the token in the anonymous Adonis session through a POST endpoint, then redirect to `/register?accountType=consumer`.

### 5.6 Vendor Type Storage

Use a pragmatic hybrid for vendor classification:

- Free-text `vendor_type`.
- Lightweight normalized `vendor_type_normalized`.
- Optional JSON array for aliases or categories.

Do not introduce a category reference table in MVP.

### 5.7 Google Listings And Future Claims

Google-sourced vendors should become `vendor_listings` when selected vendors are used to create the first project.

`vendor_listings` should be prepared for future vendor claims by storing:

- `google_place_id`
- `claimed_by_user_uuid`
- `claimed_at`
- `claim_status`

Future claiming flow:

1. Vendor verifies through Google.
2. Envoy matches by Google Place ID first.
3. Envoy falls back to email, domain, or phone if needed.
4. Conflicts are blocked for manual resolution later.

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
  - infer vendor types
  - produce Google Places search queries
  |
  v
Project-management searches:
  - Envoy vendor_listings
  - Google Places API
  |
  v
Merged recommendation list
  - Envoy vendors first
  - Google vendors next
  - deduped by email when available
  |
  v
Consumer selects vendors
  - max 8 vendors
  |
  v
Draft is updated with selected vendors
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
  - creates or reuses vendor_listings
  - creates user vendor mappings
  - creates project_vendor rows
  - creates outreach drafts
  |
  v
Project page Outreach review
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
- Source: Envoy or Google
- Onboarded to Envoy flag for Envoy-sourced vendors
- Vendor type/classification
- Rating and rating count when available
- Price level or pricing signal when available
- Website
- Phone
- Email when available

Selection behavior:

- Consumer can select one to eight vendors.
- Selected vendors persist to the anonymous onboarding draft.
- Continue action sends the user to registration.
- Continue action must not put the onboarding token in the registration URL.

---

## 8. Vendor Discovery Architecture

### 8.1 Responsibility Split

Reasoning-engine:

- Receives project blurb and ZIP code.
- Infers up to four relevant vendor types.
- Produces search queries suitable for Google Places API.
- Returns structured JSON only.

Project-management:

- Owns anonymous draft persistence.
- Calls reasoning-engine for classification/query generation.
- Searches Envoy database.
- Calls Google Places API.
- Merges and dedupes results.
- Persists selected vendor candidates to the draft.
- Creates project, vendor listings, vendor mappings, project-vendor mappings, and outreach drafts after registration.

### 8.2 Why Not Call Google From Reasoning-Engine

Project-management should call Google Places directly because:

- It owns vendor persistence.
- It owns dedupe and source priority rules.
- It owns anonymous draft state.
- It can keep external API integration separate from reasoning topic/action selection.

---

## 9. Vendor Result Priority And Deduplication

Priority:

1. Envoy vendor listings.
2. Google Places vendors.

Deduplication:

- Primary MVP dedupe key: email when available.
- Secondary recommended dedupe keys: Google Place ID, normalized name plus postal code or phone.
- Google results must be deduped across all Places query responses before the Envoy-vs-Google merge priority is applied.

An Envoy listing should win over a Google result when both refer to the same business.

---

## 10. Project Creation Handoff

After registration, the user should land on a dedicated first-project completion screen, not the generic dashboard.

The post-registration handoff must be user-associated. During registration, project-management validates the onboarding token from the request body or anonymous session, associates the active draft to the new user, and redirects to `/onboarding/project`. `OnboardingProjectController.show` and `store` then load the active draft by authenticated user UUID. They should not require or accept the raw token after login.

The screen should prefill:

- Description from the project blurb.
- ZIP/location from intake.
- Selected vendors from recommendations.

The user completes any remaining required project fields according to the current project model and validators.

The project record should be created only after final submission.

---

## 11. Outreach Draft Creation

After project creation succeeds:

1. Selected vendors are linked to the project.
2. Envoy automatically creates initial outreach drafts for all selected vendors, capped at eight drafts from the selected vendor limit.
3. Draft creation should use existing outreach infrastructure.
4. Drafts should not be sent automatically.
5. The user should review, edit, approve, or send drafts from the existing project Outreach experience.

If automatic draft generation fails for one vendor:

- Project creation should still succeed.
- The failed draft should be surfaced as an error or missing draft in the Outreach tab.
- Errors should be logged.

---

## 12. Vendor Onboarding Later Phase

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
Google business verification
  |
  v
Pending approval / blocked state until approved
  |
  v
Vendor listing management page
```

Vendor users are blocked until approval.

Once approved, vendors can update most listing fields. Google fields are treated as initial data, not immutable truth.

---

## 13. Data Ownership

Project-management owns:

- Anonymous onboarding drafts.
- Vendor listings.
- User vendor mappings.
- Project vendor mappings.
- Projects.
- Outreach drafts.
- Vendor claim fields.
- Account roles.

Reasoning-engine owns:

- LLM prompt and response contract for vendor-type inference.
- Query generation for Places search.

Google owns:

- Business/place data returned by Places API.
- Later vendor verification mechanisms.

---

## 14. Analytics And Logging

The system may log anonymous project blurbs and vendor searches for analytics and debugging.

Recommended events:

- Anonymous intake submitted.
- Vendor types inferred.
- Places search completed.
- Vendor results shown.
- Vendor selected.
- Registration started from onboarding.
- Registration completed from onboarding.
- First project created from onboarding.
- Outreach drafts created from onboarding.

Logs should avoid storing secrets, auth tokens, or unnecessary browser identifiers.

---

## 15. Failure Handling

### 15.1 Reasoning-Engine Fails

Show a retryable error.

Do not register the user or create a project.

### 15.2 Google Places Fails

If Envoy vendors exist, show Envoy results and indicate external results are unavailable.

If no results exist, show a retryable error.

### 15.3 Anonymous Draft Expires

Show a friendly restart state and route the user back to the intake.

Draft expiry should be enforced lazily on every draft lookup by requiring `status = ACTIVE` and `expires_at > now()`. A cleanup command or scheduled job should later mark stale active drafts as `EXPIRED` for analytics and storage hygiene.

### 15.4 Selected Vendor Becomes Invalid

Skip invalid vendor candidates at project creation and show a partial-success warning.

### 15.5 Outreach Draft Creation Fails

Keep the project and vendor links.

Show the Outreach tab with missing or errored draft state.

---

## 16. Phased Delivery

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
- Add draft supersession so new drafts abandon older active drafts for the same browser/session.
- Associate the draft to the registered user and load project completion by user UUID.
- Add draft consumption after project creation.

### Phase 3: Vendor Discovery

- Add reasoning-engine vendor discovery contract.
- Add project-management service to call reasoning-engine.
- Add Google Places service.
- Limit inferred vendor types/classifications to 4.
- Search Envoy vendor listings.
- Merge, rank, and dedupe recommendations.

### Phase 4: First Project Completion

- Add onboarding project completion screen.
- Prefill from anonymous draft.
- Create project after final submit.
- Create vendor listings and mappings.
- Attach vendors to project.

### Phase 5: Outreach Draft Automation

- Generate outreach drafts automatically after onboarding project creation.
- Route user to draft review.
- Add tests and partial-failure handling.

### Phase 6: Vendor Onboarding

- Add vendor verification and approval flow.
- Add vendor listing management page.
- Implement listing claim flow.

---

## 17. MVP Recommendation

Build the consumer flow first.

The first shippable MVP should include:

- Root anonymous intake.
- Reasoning-engine vendor type/query inference.
- Envoy and Google Places vendor recommendations.
- Anonymous draft persistence for 24 hours.
- Registration auto-login.
- First-project completion from draft.
- Vendor listing creation from selected Google vendors.
- Project-vendor attachment.
- Automatic outreach drafts.

Vendor onboarding should be prepared in the data model and registration role selection, but full verification and claim management should ship after the consumer path is stable.
