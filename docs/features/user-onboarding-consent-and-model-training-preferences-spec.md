# User Onboarding Consent and Model-Training Preferences

**Status:** Approved for implementation  
**Date:** July 15, 2026  
**Application:** Envoy Project Management  
**Owners:** Product, Engineering, and Legal

## 1. Summary

Envoy will add a required legal-consent step after a new user authenticates with Google or Microsoft and before the user reaches the dashboard or another role-specific post-registration destination.

The page will require the user to accept Envoy's Terms of Service and acknowledge the Privacy Policy. It will also let the user optionally allow Envoy to use eligible data to improve and train Envoy models. Both checkboxes will start unchecked, and the user cannot continue until the required Terms checkbox is checked.

Envoy will store the user's current choices and an immutable history of consent changes. Users will be able to change the model-training preference later from the Account page. Terms acceptance cannot be withdrawn through Account Settings.

This feature applies to:

- Consumer registrations.
- Pro/vendor registrations.
- Google registrations.
- Microsoft registrations.
- Password registrations whenever password authentication is enabled.
- Existing users who do not yet have a recorded Terms acceptance.

## 2. Product Decisions

The following decisions are final for this implementation:

1. Terms acceptance is required to use authenticated Envoy product features.
2. Model-training participation is optional and defaults to off.
3. Both onboarding checkboxes start unchecked.
4. The Privacy Policy is acknowledged rather than treated as a contract the user agrees to.
5. Terms and Privacy links open accessible in-page modal dialogs. Their normal URLs remain available as fallbacks and for opening in a separate tab.
6. The preference applies to eligible Envoy-native data, not connected mailbox data or other excluded data defined in this specification.
7. When a user opts in, all of that user's eligible historical and future data becomes available for model improvement and training. Envoy does not need to reconstruct consent intervals or restrict eligibility to data created after the opt-in date.
8. When a user opts out, their data must be excluded from new training-data extractions and removed from queued or not-yet-trained datasets when practical. Opting out does not require Envoy to retrain, unlearn, or modify models whose training has already completed.
9. If a user opts out and later opts in again, all eligible historical and future data becomes eligible again.
10. A new Terms version does not force the user to accept the Terms again. The accepted version is retained for audit evidence only.
11. Legal may designate a Privacy Policy update as requiring a new acknowledgment. This is an acknowledgment-only event and does not reset or require the user to repeat Terms acceptance.
12. Account preference changes require an explicit Save action.
13. Envoy will retain an immutable event history in addition to the current-state preference row.
14. Existing users will default to model-training opt-out and will be required to complete the consent page the next time they authenticate.
15. Incomplete registrations may sign out. Pending accounts that never accept the Terms will be eligible for cleanup after 30 days, including best-effort provider-token revocation before deletion.

## 3. Existing System Context

The current social-authentication callback:

1. Receives the Google or Microsoft OAuth callback.
2. Creates or locates the user.
3. Creates or updates the primary inbox connection.
4. Stores a separate email-authorization consent record.
5. Signs the user in.
6. Resolves a role-specific or intended post-login destination.

Possible destinations include:

- `/dashboard`
- `/onboarding/project`
- `/vendor/pending`
- `/vendor/listing`
- A valid, previously requested authenticated URL

The existing `email_authorization_consents` table is specifically for connected-email access. It must remain separate from product Terms acceptance and model-training consent.

The registration page currently passes email-authorization acceptance into OAuth without displaying a corresponding affirmative control. This work will correct that behavior by adding a distinct, required pre-OAuth mailbox disclosure. The mailbox disclosure is not part of the post-OAuth Terms/model-training page and must not be combined with it.

## 4. End-to-End User Flows

### 4.1 New Google or Microsoft registration

1. The user opens the registration page.
2. The user selects Consumer or Pro/vendor registration.
3. Immediately before OAuth, Envoy displays the mailbox-access disclosure and requires affirmative acceptance.
4. The user selects Google or Microsoft.
5. The provider authenticates the user and grants the requested scopes.
6. Envoy receives the callback and completes the existing account and inbox-connection transaction.
7. Envoy creates the user's current consent-preference row with both booleans set to `false` if the row does not already exist.
8. Envoy authenticates the restricted user session.
9. Envoy preserves the existing intended destination without consuming the anonymous onboarding handoff or finalizing role-specific redirection.
10. Envoy redirects the user to `GET /onboarding/consent`.
11. The page renders both checkboxes unchecked.
12. The user may open and read the Terms and Privacy Policy in separate modal dialogs.
13. The user must check the Terms/Privacy acknowledgment checkbox.
14. The user may leave model-training participation unchecked or choose to opt in.
15. The user submits the page.
16. Envoy validates the request server-side and atomically updates current state and inserts immutable consent events.
17. Envoy resolves the existing post-authentication destination and redirects the user there.

### 4.2 New password registration

When password registration is enabled, account creation follows the same post-registration consent flow. The mailbox-access disclosure is omitted because no mailbox provider has been authorized. The user is authenticated into a restricted session and sent to `/onboarding/consent` before any product destination.

### 4.3 Existing user without recorded Terms acceptance

1. The user authenticates normally.
2. Envoy creates or uses a backfilled preference row with both booleans set to `false`.
3. The consent gate redirects the user to `/onboarding/consent`.
4. The page starts with both checkboxes unchecked.
5. After submission, the user continues to the normal role-specific or intended destination.

### 4.4 Returning user with recorded Terms acceptance

The user follows the existing login and redirect behavior. A newer Terms version does not trigger the consent page.

### 4.5 User abandons consent

- The user remains unable to access authenticated product features.
- Closing the browser or returning later does not count as consent.
- A later authenticated visit returns the user to `/onboarding/consent`.
- The page provides a Sign out action.
- Pending accounts that remain incomplete for 30 days are eligible for automated cleanup. Cleanup must attempt to revoke connected provider access, stop watches/subscriptions, remove stored tokens, and delete the pending user and dependent records.

### 4.6 User changes model-training preference

1. An accepted user opens `/account`.
2. The Data & Privacy section shows the persisted current preference.
3. The user changes the checkbox or switch.
4. The user selects Save.
5. Envoy validates and persists the new value.
6. Envoy inserts an immutable opt-in or opt-out event.
7. The page shows success or error feedback without changing Terms acceptance.

## 5. Consent Page Requirements

### 5.1 Route and access

- Route: `GET /onboarding/consent`
- Submission: `POST /onboarding/consent`
- Authentication is required.
- Users with no accepted Terms must be allowed to access this page.
- Users who have already accepted the Terms may be redirected to their normal destination unless they are completing a Legal-designated Privacy re-acknowledgment.
- The page must not use a layout that requires access to another consent-gated endpoint.

### 5.2 Required control

Recommended product copy, subject to final Legal copy review:

> I agree to Envoy's Terms of Service and acknowledge the Privacy Policy.

Requirements:

- One unchecked checkbox appears beside the sentence.
- `Terms of Service` links to `/terms` and opens the Terms modal on a normal primary click.
- `Privacy Policy` links to `/privacy` and opens the Privacy modal on a normal primary click.
- The checkbox is never preselected for a new or backfilled user.
- Opening or scrolling either document does not automatically check the checkbox.
- Users do not need to scroll to the bottom before checking the box.
- The checkbox must have a programmatically associated label.

### 5.3 Optional model-training control

Recommended product copy, subject to final Legal copy review:

> Allow Envoy to use eligible content I submit to improve and train Envoy models. This is optional, does not affect access to Envoy, and can be changed later in Account Settings.

Supporting text must explain that:

- Opting in makes all eligible historical and future Envoy-native data available.
- Opting out later stops the data from being included in new training-data extractions.
- Opting out cannot necessarily remove influence from training that has already completed.
- Connected Google or Microsoft mailbox data is excluded regardless of this preference.

Requirements:

- The control starts unchecked.
- It is not required to continue.
- Leaving it unchecked records `model_training_opt_in = false`.
- Checking it records `model_training_opt_in = true`.

### 5.4 Continue action

- The Continue button is disabled while Terms acceptance is unchecked.
- The disabled state must be both visually clear and exposed to assistive technology.
- Checking only the optional model-training control does not unlock Continue.
- Checking the Terms control unlocks Continue regardless of the model-training choice.
- While submitting, the button is disabled and shows a processing state.
- Double submission must not create duplicate event records.
- Server validation must reject a missing or false Terms value even if the client-side disabled state is bypassed.

### 5.5 Legal-document modals

The Terms and Privacy modals must:

- Use the native `<dialog>` element or an equivalent accessible dialog implementation.
- Have a visible heading and Close button.
- Have `aria-labelledby` or equivalent accessible naming.
- Keep keyboard focus inside the open dialog.
- Close with Escape.
- Return focus to the link that opened the dialog.
- Provide a scrollable document body sized for mobile and desktop viewports.
- Prevent background content from being read or interacted with while open.
- Preserve normal anchor behavior for modified clicks, opening in a new tab, or when JavaScript is unavailable.

The legal articles must be extracted into reusable Svelte components. The existing `/terms` and `/privacy` pages and the new dialogs must render those shared components so legal text cannot drift between copies.

## 6. Separate Pre-OAuth Mailbox Disclosure

Google and Microsoft mailbox authorization remains a distinct consent from product Terms and model-training participation.

Before redirecting a registration flow to either provider, Envoy must display and require an unchecked authorization control using the existing disclosure meaning:

> I authorize Envoy to view my email, prepare local drafts, and send approved messages from my connected account.

Requirements:

- The disclosure is displayed immediately before the Google/Microsoft provider controls.
- It requires affirmative action and is not preselected.
- Provider controls remain disabled until it is accepted.
- The server continues rejecting registration OAuth attempts without the accepted mailbox-authorization state.
- The existing `email_authorization_consents` record continues storing provider, scopes, disclosure version/text, IP address, user agent, and timestamp.
- This consent must not set either `terms_accepted` or `model_training_opt_in`.

## 7. Data Eligibility Semantics

### 7.1 Eligible when opted in

The first implementation limits training eligibility to Envoy-native data in these categories:

- Project descriptions, requirements, constraints, budgets, goals, and other project-scoping inputs entered directly into Envoy.
- Prompts and chat messages entered directly into Envoy.
- Envoy-generated project scopes, estimates, outlines, recommendations, and other outputs.
- Corrections, ratings, and explicit product/model feedback submitted directly to Envoy.
- De-identified product usage and model-performance signals that are not derived from a connected provider.

When the current preference is `true`, all eligible historical and future records in these categories are eligible. Training jobs do not need to determine whether each record was created during a prior opt-in interval.

### 7.2 Always excluded

The preference does not authorize training on:

- Gmail, Google Workspace, Outlook, Microsoft Graph, or other connected-provider message bodies, attachments, headers, metadata, contacts, or derived data.
- OAuth access tokens, refresh tokens, authorization codes, provider identifiers used only for authentication, or encryption material.
- Passwords or other authentication credentials.
- Payment-card, bank-account, billing credential, or payment-token data.
- Direct identifiers such as name, email address, IP address, mailing address, and phone number unless separately de-identified under an approved process.
- Private communications authored by vendors or other third parties.
- Data whose use is prohibited by contract, provider policy, law, or a deletion/retention requirement.

Google's Workspace policy expressly prohibits using Workspace API data to create, train, or improve a generalized model beyond a model personalized for the specific user. See [Google Workspace User Data and Developer Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy?hl=en#limited-use).

Microsoft API data may not be used outside permissions expressly granted by customers, and changed processing requires additional consent. See [Microsoft APIs Terms of Use](https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use).

Envoy will use the same exclusion rule for all connected mailbox providers to give users consistent behavior and reduce compliance risk.

### 7.3 Extraction behavior

Every training-data export, model-improvement job, evaluation-dataset builder, feedback pipeline, or equivalent process must:

1. Join source records to the owning Envoy user.
2. Join the user to the current consent-preference row.
3. require `model_training_opt_in = true` at extraction time.
4. Treat a missing row as opted out.
5. Apply the always-excluded categories after the eligibility join.
6. Record the extraction/job identifier, extraction time, and preference snapshot used for operational auditability.

No per-record consent timestamp comparison is required. If a user opts in today, eligible content created before today may be included. If the user later opts out, the current-state join excludes all of that user's data from subsequent extractions. If the user opts in again, all eligible historical data is eligible again.

### 7.4 Effect of opting out

After a saved opt-out:

- New extraction jobs exclude the user's data.
- Data already staged or queued but not used for completed training should be removed when practical.
- Existing source data may remain in Envoy for core product, security, retention, contractual, or legal purposes.
- Envoy does not promise to reverse completed training, retrain existing models, or provide machine unlearning unless a later policy explicitly adds that capability.

## 8. Database Design

### 8.1 Current state table

Create `envoy_schema.user_consent_preferences`.

| Column | Type | Null | Rules and purpose |
| --- | --- | --- | --- |
| `id` | `bigserial` | No | Primary key. |
| `uuid` | `uuid` | No | Unique stable identifier. |
| `user_uuid` | `uuid` | No | Unique FK to `envoy_schema.users(uuid)` with `ON DELETE CASCADE`. One current row per user. |
| `terms_accepted` | `boolean` | No | Defaults to `false`. Once accepted, normal user-facing operations cannot set it to false. |
| `terms_version` | `varchar(64)` | Yes | Version accepted by the user. Stored for evidence; version changes do not force reacceptance. |
| `terms_accepted_at` | `timestamptz` | Yes | First successful Terms acceptance time. |
| `privacy_policy_version` | `varchar(64)` | Yes | Privacy version acknowledged with the Terms or through a later acknowledgment-only flow. |
| `privacy_policy_acknowledged_at` | `timestamptz` | Yes | Latest acknowledgment time. |
| `model_training_opt_in` | `boolean` | No | Defaults to `false`; current extraction eligibility control. |
| `model_training_notice_version` | `varchar(64)` | Yes | Disclosure version presented for the current choice. |
| `model_training_preference_updated_at` | `timestamptz` | Yes | Latest explicit opt-in/opt-out choice time. |
| `created_by_user_uuid` | `uuid` | Yes | FK to `users(uuid)` with `ON DELETE SET NULL`. |
| `created_timestamp` | `timestamptz` | No | Defaults to `NOW()`. |
| `modified_by_user_uuid` | `uuid` | Yes | FK to `users(uuid)` with `ON DELETE SET NULL`. |
| `modified_timestamp` | `timestamptz` | No | Defaults to `NOW()` and is updated on change. |

Required constraints and indexes:

- Unique constraint on `uuid`.
- Unique constraint on `user_uuid`.
- Index on `model_training_opt_in` suitable for extraction joins if query analysis shows it is beneficial.
- Check constraint requiring `terms_version` and `terms_accepted_at` when `terms_accepted = true`.
- Check constraint requiring a notice version and preference timestamp after the onboarding preference has been explicitly submitted.

The initial row is created with both booleans false. The first successful consent submission updates that row atomically.

### 8.2 Immutable event table

Create `envoy_schema.user_consent_events`.

| Column | Type | Null | Rules and purpose |
| --- | --- | --- | --- |
| `id` | `bigserial` | No | Primary key. |
| `uuid` | `uuid` | No | Unique event identifier. |
| `user_uuid` | `uuid` | No | FK to `users(uuid)` with `ON DELETE CASCADE`. |
| `event_type` | `varchar(48)` | No | Allowed values listed below. |
| `terms_version` | `varchar(64)` | Yes | Version involved in a Terms event. |
| `privacy_policy_version` | `varchar(64)` | Yes | Version involved in a Privacy event. |
| `model_training_opt_in` | `boolean` | Yes | Value involved in a training-preference event. |
| `model_training_notice_version` | `varchar(64)` | Yes | Disclosure version shown for the event. |
| `disclosure_text` | `text` | No | Exact user-facing legal/preference sentence shown for audit evidence. |
| `actor_user_uuid` | `uuid` | Yes | FK to `users(uuid)` with `ON DELETE SET NULL`. |
| `source` | `varchar(32)` | No | `ONBOARDING`, `ACCOUNT`, `PRIVACY_REACK`, or an approved future administrative source. |
| `ip_address` | `varchar(64)` | Yes | Request IP when available. |
| `user_agent` | `text` | Yes | Request user agent when available. |
| `created_timestamp` | `timestamptz` | No | Defaults to `NOW()`. Events are immutable. |

Allowed event types:

- `TERMS_ACCEPTED`
- `PRIVACY_POLICY_ACKNOWLEDGED`
- `MODEL_TRAINING_OPTED_IN`
- `MODEL_TRAINING_OPTED_OUT`

Required indexes:

- Unique constraint on `uuid`.
- Index on `(user_uuid, created_timestamp DESC)`.
- Index on `(event_type, created_timestamp DESC)` if operational reporting needs it.

Application code must not update or delete individual consent events. Account deletion may remove the events through the user foreign key in accordance with Envoy's deletion obligations.

### 8.3 Version constants

Define explicit application constants for:

- Terms version.
- Privacy Policy version.
- Model-training disclosure version.
- Email-authorization disclosure version, which remains separate.

The Terms version is recorded but is not compared by the consent gate. A later Terms text change therefore does not reset `terms_accepted`.

A Privacy re-acknowledgment is activated only when Legal explicitly marks a Privacy update as material and changes the separately configured required Privacy acknowledgment version.

## 9. Backend Behavior

### 9.1 Consent service

Create a dedicated service responsible for:

- Creating an initial false/false current-state row idempotently.
- Reading the current preference for page props and middleware.
- Completing initial consent in a database transaction.
- Updating model-training preference in a database transaction.
- Inserting immutable events with exact disclosure text and request metadata.
- Preventing Terms acceptance from being reset through the normal preference update path.
- Handling concurrent or repeated submissions without duplicate state or events.

### 9.2 Initial consent transaction

The onboarding submission transaction must:

1. Lock or safely upsert the current preference row for the authenticated user.
2. Reject the request unless `termsAccepted === true`.
3. Preserve the first Terms acceptance timestamp if an idempotent retry occurs.
4. Set `terms_accepted = true`.
5. Set the Terms and Privacy versions and timestamps.
6. Set `model_training_opt_in` to the submitted boolean.
7. Set the model-training notice version and preference timestamp.
8. Set the actor and modified metadata.
9. Insert `TERMS_ACCEPTED` and `PRIVACY_POLICY_ACKNOWLEDGED` events if they do not already exist for this completion.
10. Insert either `MODEL_TRAINING_OPTED_IN` or `MODEL_TRAINING_OPTED_OUT`.
11. Commit before redirecting.

Use an idempotency strategy such as a unique completion key, event uniqueness constraint, or state transition check so a network retry does not duplicate events.

### 9.3 Account preference transaction

The Account update transaction must:

1. Require an authenticated user with accepted Terms.
2. Validate that `modelTrainingOptIn` is a boolean.
3. Update only model-training preference fields and modified metadata.
4. Insert an event only when the persisted value actually changes.
5. Leave Terms and Privacy fields unchanged.
6. Return success feedback through the existing Inertia flash pattern.

### 9.4 Consent-required middleware

Register a named consent middleware and apply it after authentication but before role-specific middleware.

Behavior:

- Missing preference row: create or treat as false/false, preserve the requested safe local destination, and require consent.
- `terms_accepted = false`: require consent.
- `terms_accepted = true`: proceed, regardless of stored Terms version.
- Material Privacy re-ack pending: route to the acknowledgment flow without resetting Terms acceptance.
- Browser/Inertia request: redirect to `/onboarding/consent`.
- JSON/API request: return an explicit `428 Precondition Required` response with a stable `CONSENT_REQUIRED` error code and consent-page URL.

Do not apply the gate to:

- `/onboarding/consent` GET or POST.
- `/terms`.
- `/privacy`.
- `/logout`.
- Public authentication and password-recovery endpoints.
- Health/version endpoints.
- Internal service callbacks that do not represent a user session.

### 9.5 Redirect preservation

The OAuth and password-registration handlers must not discard or prematurely consume current redirect state before consent is completed.

- Keep the anonymous onboarding token available until after successful consent.
- Preserve only validated same-origin paths beginning with a single `/`.
- Reject protocol-relative URLs and auth/consent redirect loops.
- After consent commits, invoke the existing role/onboarding redirect resolution.
- Consumer anonymous-onboarding handoff continues to `/onboarding/project` when applicable.
- Vendors continue to `/vendor/pending` or `/vendor/listing` based on approval state.
- Otherwise use the valid intended path or `/dashboard`.

## 10. Account Page Requirements

Add a `Data & Privacy` card to `/account`.

It must include:

- A heading and concise description.
- The persisted model-training preference.
- Clear eligible-data and excluded-data summaries.
- Links to `/terms` and `/privacy`.
- The date the preference was last changed, when available.
- An explicit Save button.
- Processing, success, and error states.

Recommended control copy:

> Allow Envoy to use my eligible Envoy content to improve and train Envoy models.

Recommended supporting copy:

> When enabled, eligible content from both before and after you opt in may be used. Connected email data, credentials, payment data, and direct identifiers are excluded. Turning this off stops your data from being added to new training runs but may not reverse training that has already completed.

The Account page does not provide a control to withdraw Terms acceptance. A user who no longer accepts the Terms must stop using Envoy and may use the applicable account-deletion or support process.

Proposed endpoint:

- `PATCH /account/data-preferences`

If the existing form infrastructure is more consistent with POST, `POST /account/data-preferences` is acceptable as long as it has the same validation and idempotent behavior.

## 11. Legal Content Changes

Legal must approve final copy before release.

### 11.1 Terms of Service

The current AI Training License language grants training rights through general Terms acceptance. It must be changed so that:

- Core processing needed to provide Envoy remains covered by the Terms.
- Generalized model improvement/training on eligible user content is described as optional.
- The separate affirmative opt-in controls that optional use.
- Opting out does not prevent normal use of Envoy.
- Connected-provider data is not included in generalized training.
- Opt-out is prospective for new extraction/training activity and does not promise reversal of completed training.
- Terms updates do not promise or trigger automatic reacceptance in the application.

### 11.2 Privacy Policy

The Privacy Policy must:

- Define the eligible Envoy-native categories.
- Define the always-excluded categories.
- State that opting in makes eligible historical and future data available.
- Explain how to change the preference from Account Settings.
- Explain the effect and limits of opting out.
- State that missing consent means opt-out.
- Preserve and strengthen Google Workspace Limited Use disclosures.
- Describe the immutable consent records and relevant retention/deletion behavior.
- Explain any material Privacy re-acknowledgment process.

### 11.3 Shared legal components

Extract the document bodies from the existing page shells into shared components, for example:

- `inertia/components/legal/terms_content.svelte`
- `inertia/components/legal/privacy_content.svelte`
- `inertia/components/legal/legal_document_dialog.svelte`

The existing public pages keep their URLs and page shells while rendering the shared article content.

## 12. Validation and Security

- Never trust the client-side disabled state.
- Require strict booleans; do not interpret arbitrary truthy strings as consent.
- Require CSRF protection through the existing session/Inertia request stack.
- Bind all writes to the authenticated user's UUID; do not accept a user UUID from the request body.
- Store IP address and user agent as metadata, not as proof by themselves.
- Validate and normalize all preserved redirect paths to prevent open redirects.
- Keep OAuth provider tokens encrypted using the existing token-encryption service.
- Keep the model-training preference separate from OAuth scope authorization.
- Ensure logs do not contain OAuth tokens, passwords, legal-document contents submitted by users, or unnecessarily identifying training source data.
- Make event insertion and current-state updates atomic.
- Ensure cleanup revokes or disconnects provider authorization before deleting a never-completed account when possible.

## 13. Migration and Rollout

### 13.1 Migration

1. Create both consent tables, constraints, and indexes.
2. Backfill one current-state row for each existing user:
   - `terms_accepted = false`
   - `model_training_opt_in = false`
   - version and acceptance fields null
   - creation/modification actor null or system, according to the final migration convention
3. Do not create affirmative consent events during backfill.
4. Keep `ON DELETE CASCADE` from the current-state and event tables to the owning user so the existing user cleanup workflow remains effective.

### 13.2 Deployment order

Recommended safe order:

1. Deploy schema and model support.
2. Deploy service, controllers, validators, routes, and middleware in a mode that can read the new rows.
3. Deploy UI and shared legal components.
4. Publish approved Terms and Privacy revisions.
5. Enable the consent gate and existing-user enforcement together with the approved legal copy.
6. Confirm training/export systems fail closed for false or missing preferences before accepting any opt-ins.
7. Enable the pending-registration cleanup job after verifying provider revocation and cascade behavior.

### 13.3 Rollback behavior

- Disabling the route gate must not convert missing/false preferences into opt-in.
- Training jobs must continue treating missing or false preference rows as ineligible during any application rollback.
- Consent event records must not be deleted during a normal application rollback.
- A migration rollback that drops consent data is not appropriate after production consent collection begins without an approved retention/export plan.

## 14. Expected Code Areas

Implementation is expected to touch or add files in these areas:

- `database/migrations/`
- `app/models/user_consent_preference.ts`
- `app/models/user_consent_event.ts`
- `app/services/user_consent_service.ts`
- `app/validators/user_consent_validator.ts`
- `app/controllers/web/onboarding_consent_controller.ts`
- `app/controllers/web/auth_controller.ts`
- `app/controllers/web/account_controller.ts`
- `app/middleware/consent_required_middleware.ts`
- `start/kernel.ts`
- `start/routes.ts`
- `inertia/pages/onboarding/consent.svelte`
- `inertia/pages/account.svelte`
- `inertia/pages/auth/register.svelte`
- `inertia/pages/terms.svelte`
- `inertia/pages/privacy.svelte`
- Shared legal-dialog/content components.
- Functional, unit, and Playwright test suites.
- Pending-registration cleanup command/service and its tests.

Exact filenames may follow existing repository naming conventions during implementation.

## 15. Test Plan

### 15.1 Backend functional tests

Cover at minimum:

- Google registration redirects a new user to consent rather than directly to the dashboard.
- Microsoft registration redirects a new user to consent.
- Consumer and vendor destinations are preserved.
- Anonymous project-onboarding handoff survives the consent step.
- Password registration requires consent when enabled.
- Returning accepted users skip consent even when the current Terms version has changed.
- Existing/backfilled users are required to complete consent.
- Missing or false Terms acceptance returns a validation error and does not mutate consent state.
- Model-training false is accepted and persisted.
- Model-training true is accepted and persisted.
- Current-state update and event inserts occur atomically.
- Duplicate submission does not create duplicate completion events.
- Direct dashboard, project, contact, inbox, vendor, and authenticated API access is gated.
- Consent, legal, and logout routes do not loop.
- JSON/API requests receive `428` with `CONSENT_REQUIRED`.
- Unsafe external or protocol-relative redirect targets are rejected.
- Account updates change only the model-training fields.
- Account updates create events only when the value changes.
- A missing preference row is always treated as opt-out.
- User deletion cascades to both consent tables.
- Pending-account cleanup stops watches/subscriptions, attempts revocation, and deletes dependent data.
- Mailbox authorization remains separate and is required before registration OAuth.

### 15.2 Model and service tests

Cover:

- UUID assignment.
- One current preference row per user.
- Required acceptance metadata constraints.
- Terms cannot be reset through the account service.
- Correct event types, versions, exact disclosure text, actor, IP, user agent, source, and timestamps.
- Opt-in, opt-out, and re-opt-in state transitions.
- Historical eligibility semantics: current opt-in makes pre-opt-in eligible records available.
- Current opt-out excludes all records from new extraction regardless of their creation date.

### 15.3 UI/Playwright tests

Cover:

- Both onboarding checkboxes render unchecked.
- Continue starts disabled.
- The optional checkbox alone does not enable Continue.
- Terms acceptance enables Continue.
- Leaving model training unchecked completes onboarding as opted out.
- Checking model training completes onboarding as opted in.
- Terms and Privacy links open the correct dialogs.
- Dialogs close by button and Escape and restore focus.
- Modified link clicks retain normal navigation behavior.
- Keyboard-only completion works.
- Processing prevents duplicate submission.
- Account Settings loads the saved value.
- Account changes require Save and persist on reload.
- Success and error feedback is accessible.
- Mobile dialog and page layouts remain usable.
- Pre-OAuth mailbox authorization begins unchecked and gates provider buttons.

## 16. Acceptance Criteria

The feature is complete when all of the following are true:

1. Every new Consumer and Pro/vendor registration, including password registration when enabled, completes required Terms acceptance before accessing authenticated product functionality.
2. Existing users without recorded acceptance are gated on their next authentication.
3. Both onboarding controls begin unchecked.
4. Continue remains unavailable until Terms acceptance is selected.
5. The server rejects any attempted completion without Terms acceptance.
6. Users can complete onboarding with model training either off or on.
7. Current values, versions, actors, and timestamps are stored.
8. Immutable events capture the exact disclosure and request metadata.
9. The existing destination, user role, and anonymous project-onboarding behavior remain correct.
10. Users cannot bypass consent by navigating directly to product pages or APIs.
11. Account Settings accurately reads and changes the model-training preference with an explicit Save action.
12. Opted-in users make all eligible historical and future Envoy-native data available to compliant training extraction.
13. False or missing preferences fail closed and are excluded from new extraction.
14. Provider-derived mailbox data and all other excluded categories never become eligible through this preference.
15. A later Terms version does not prompt accepted users again.
16. Legal dialogs are accessible and use the same source content as the public legal pages.
17. Updated Terms and Privacy copy has received Legal approval.
18. The existing separate email-authorization consent remains intact and is presented affirmatively before OAuth.
19. Automated tests cover the critical flows, validation, gating, persistence, eligibility, accessibility, and cleanup behavior.

## 17. Out of Scope

This work does not include:

- Machine unlearning or retraining completed models after a user opts out.
- Using Gmail, Microsoft, or other connected-provider mailbox data for generalized training.
- Letting users withdraw Terms acceptance while retaining product access.
- Requiring Terms reacceptance because the Terms version changes.
- A user-facing consent-event history viewer.
- Administrative overrides of a user's model-training choice.
- Expanding training eligibility beyond the categories explicitly approved in this specification.

