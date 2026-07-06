# Email Handling Overview

Last reviewed: 2026-06-26

This document summarizes how `envoy-project-management` and `envoy-email-service`
currently handle customer email authorization, inbox viewing, draft creation, and
sending. It also separates what works today from the Microsoft/provider work that
is still required.

## High-Level Status

- Gmail inbox connection is the only end-to-end connected-mailbox path enabled
  today.
- Microsoft inbox OAuth has partial scaffolding in `envoy-project-management`,
  but the web controller blocks it and `envoy-email-service` rejects every
  provider except `gmail`.
- User sign-in/registration and mailbox authorization are separate flows today.
  Signing in with Google or Microsoft does not grant Envoy permission to read,
  draft, or send mail.
- Drafts are currently Envoy application drafts stored in
  `envoy_schema.outreach_drafts`; they are not Gmail or Outlook Drafts folder
  records.
- Product direction: keeping drafts local is acceptable. Drafts should remain in
  Envoy until the user sends them; at send time, the outbound email should be
  persisted to the relevant vendor conversation as a `Message`.
- Sending uses the customer's connected inbox when available. If no inbox is
  connected, outreach falls back to the Envoy system mailbox through Adonis Mail
  and Resend.

## Current Repositories Involved

### `envoy-project-management`

This is the primary application. It owns:

- User authentication and registration.
- Inbox OAuth start/callback routes.
- The `user_inbox_connections` database table.
- Token refresh before mailbox calls.
- Outreach drafts, outreach threads, message persistence, and UI state.
- Calls to `envoy-email-service` for mailbox list/message/send operations.
- Transactional/system email through Resend.

Key files:

- `config/ally.ts`
- `config/inbox.ts`
- `config/mail.ts`
- `start/routes.ts`
- `app/controllers/web/auth_controller.ts`
- `app/controllers/web/inbox_controller.ts`
- `app/controllers/web/account_controller.ts`
- `app/controllers/api/project_outreach_api_controller.ts`
- `app/controllers/api/inbox_api_controller.ts`
- `app/services/inbox_connection_service.ts`
- `app/services/email_communication_service.ts`
- `app/services/inbox_sync_service.ts`
- `app/services/inbox_reply_service.ts`
- `app/services/project_outreach_service.ts`
- `app/models/user_inbox_connection.ts`
- `app/models/outreach_draft.ts`
- `database/migrations/1771300000000_create_user_inbox_connections_table.ts`
- `database/migrations/1775000000000_add_outreach_drafts_and_project_scoped_threads.ts`
- `inertia/pages/account.svelte`
- `inertia/pages/auth/register.svelte`

### `envoy-email-service`

This is a small Lambda/HTTP service called by project management. It owns:

- `POST /send-on-behalf`
- `POST /inbox/list`
- `POST /inbox/message`
- Optional API-key protection through `Authorization: Bearer <token>`
- Gmail API calls for listing, reading, and sending mail

Key files:

- `src/index.ts`
- `src/models/email.ts`
- `src/utils/request-validation.ts`
- `src/services/inbox-service.ts`
- `src/services/send-on-behalf-service.ts`
- `src/local-server.ts`

## Account Authentication vs Mailbox Authorization

### User authentication

Normal app authentication happens through:

- Email/password registration and login.
- Google social sign-in.
- Microsoft social sign-in.

The social sign-in scopes in `config/ally.ts` are identity/profile scopes:

- Google: `userinfo.email`, `userinfo.profile`, `openid`
- Microsoft: `openid`, `profile`, `email`, `User.Read`

Those scopes let the app identify the user and create or update the Envoy user
record. They do not authorize Envoy to read Gmail/Outlook messages, create mail
drafts, or send mail on the user's behalf.

### Mailbox authorization

Mailbox authorization currently starts from the Account page. When a user has no
connected inbox, `inertia/pages/account.svelte` renders a `Connect Gmail` link:

```text
/inbox/connect?provider=gmail
```

That route is defined in `start/routes.ts` and handled by
`app/controllers/web/inbox_controller.ts`.

The current Gmail connection flow is:

1. Authenticated user clicks `Connect Gmail`.
2. `InboxController.connect` accepts only `provider=gmail`.
3. `getAuthUrl('gmail', user.uuid)` in `inbox_connection_service.ts` creates a
   Google OAuth URL.
4. The OAuth `state` value is a base64url JSON payload containing
   `{ userUuid, provider }`.
5. Google redirects back to `/inbox/callback`.
6. `InboxController.callback` checks that the decoded state user matches the
   currently authenticated user.
7. `exchangeCode('gmail', code, state)` exchanges the code for tokens, fetches
   the Google profile email, and returns the access token, refresh token, expiry,
   email, and granted scopes.
8. `UserInboxConnection.updateOrCreate` stores the connection by
   `(user_uuid, provider, email)`.

The stored record includes:

- `provider`
- `email`
- `access_token`
- `refresh_token`
- `access_token_expires_at`
- `scopes`

The Lucid model hides tokens from serialization with `serializeAs: null`, but the
schema stores token values in text columns. I did not find an application-level
encryption wrapper around those columns.

## Current OAuth Scopes

### Gmail inbox scopes

`config/inbox.ts` currently requests:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/userinfo.email`

The OAuth URL also uses:

- `access_type: 'offline'`
- `prompt: 'consent'`

That is what gives the application a refresh token when Google returns one.
Offline access lets Envoy continue refreshing access tokens and perform mailbox
work while the user is not online, but it is not a permanent authorization
guarantee. Google documents several cases where refresh tokens can stop working,
including user revocation, six months of non-use, Gmail-scope password changes,
refresh-token limits, time-based access expiration, and admin policy changes.

The current Gmail scope set is broader than the app strictly needs for the
current local-draft implementation. Since drafts are stored in Envoy and sending
uses the Gmail send API, the minimum practical Gmail scopes are closer to:

- `gmail.readonly` for viewing/syncing mail.
- `gmail.send` for sending directly.
- `userinfo.email` for resolving the mailbox address.

If we want to create real Gmail Drafts folder entries, use `gmail.compose` or
keep `gmail.modify`, depending on whether we also need label/message mutation.
The Google Gmail API scope reference documents these scopes, and the Gmail
drafts guide documents the draft create/send flow.

### Microsoft inbox scopes

`config/inbox.ts` already defines Microsoft inbox scopes:

- `https://graph.microsoft.com/Mail.Read`
- `https://graph.microsoft.com/Mail.Send`
- `https://graph.microsoft.com/User.Read`
- `offline_access`
- `openid`

`inbox_connection_service.ts` can generate a Microsoft authorize URL, exchange a
code with the Microsoft identity platform, fetch `/me` from Microsoft Graph, and
refresh Microsoft access tokens.

Microsoft offline/background access requires `offline_access` so the token
response can include a refresh token. Microsoft refresh tokens are long-lived
relative to access tokens, but they can expire or be revoked by the sign-in
service, user action, credential changes, or admin action. The app must be able
to ask the user to reconnect when refresh fails.

However, Microsoft is not actually enabled today:

- `InboxController.connect` redirects back with `Outlook inbox connection is not
  available yet.`
- `InboxController.callback` rejects any decoded provider other than `gmail`.
- `envoy-email-service` only accepts `provider: 'gmail'` and only implements
  Gmail API calls.

Because drafts are allowed to remain local until sent, Outlook provider-draft
creation is not required for the current product direction. If we later want
drafts to appear in the user's Outlook Drafts folder, Microsoft Graph will need
`Mail.ReadWrite` in addition to `Mail.Send`.

## Token Refresh

Project management refreshes tokens before calling the email service.

`ensureValidToken(connection)` checks `access_token_expires_at` with a
five-minute buffer. If the token is missing or near expiry, it calls
`refreshConnectionTokens(connection)`.

Refresh behavior:

- Gmail refresh uses the Google OAuth client and the stored refresh token.
- Microsoft refresh uses the Microsoft token endpoint and the stored refresh
  token.
- The refreshed access token, optional rotated refresh token, and expiry are
  saved back to `user_inbox_connections`.

`envoy-email-service` does not refresh tokens. It receives a current access token
from project management on every request.

## Viewing Emails

There are two sync-related paths in project management.

### Project Outreach refresh

```text
POST /api/projects/:uuid/outreach/sync
```

Handled by:

- `ProjectOutreachApiController.sync`
- `buildManualBackfillEvent` and `enqueueEmailSyncEvent` in
  `email_sync_event_service.ts`

The flow:

1. Load the project for the authenticated user.
2. Return the current outreach state immediately.
3. Enqueue a `manual_backfill` SQS event for the user's active primary inbox.
4. The background sync worker refreshes the token if needed, searches provider
   mail for known vendor email addresses, de-duplicates by provider message id,
   fetches message details, and persists matching vendor conversations.
5. If a new inbound message is a reply to a thread with prior outbound mail, the
   worker fire-and-forgets an AI-generated local reply draft.

This endpoint intentionally does not perform provider mailbox scans inline. The
old direct `syncProjectOutreach` path remains in `project_outreach_service.ts`
for now, but the UI refresh button uses the SQS-backed worker path to avoid
CloudFront or ALB request timeouts during Gmail and Microsoft backfills.

### Older/global inbox sync

`inbox_sync_service.ts` has a broader `syncConnection` and `syncAllConnections`
path. It:

- Lists recent messages through the email service.
- Matches senders to vendor listings.
- Creates `VendorConversation`, `Communication`, and `Message` records.

The project-scoped outreach service appears to be the path that powers the
current Outreach tab behavior.

## Creating Drafts

Current draft creation is local to Envoy, and that should remain the default
behavior. A draft can be created, revised, and stored in
`envoy_schema.outreach_drafts` without creating a Gmail or Outlook Drafts folder
record. When the user approves and sends the draft, Envoy should persist the sent
email as an outbound `Message` in the corresponding vendor conversation.

User-driven draft creation:

```text
POST /api/projects/:uuid/outreach/drafts
```

Handled by:

- `ProjectOutreachApiController.createDraft`
- `createOutreachDraft` in `project_outreach_service.ts`

The flow:

1. Validate the project and selected project vendor.
2. Create a project-scoped `VendorConversation`.
3. Create an `OutreachDraft` row with empty `subject` and `body`.
4. Return updated Outreach state to the frontend.

AI-driven draft creation:

- `generateInitialOutreachDrafts` creates one `OUTREACH` reasoning request per
  project vendor and stores successful responses as local `OutreachDraft` rows.
- Draft and reply revisions call the `OUTREACH` agent directly and parse
  `data.subject` and `data.body` from the response envelope.
- `draftReplyForInboundMessage` can create a local reply draft after inbound
  email sync when the thread already has prior outbound mail.

No current code creates provider-side draft messages in Gmail or Outlook. There
are no calls to Gmail `users.drafts.create` or Microsoft Graph draft-message
creation APIs. With local drafts as the chosen approach, provider-side draft
creation can remain a future optional capability instead of a Microsoft launch
requirement.

This matters for registration consent wording. The app can ask for approval to
view the user's mailbox, prepare local drafts in Envoy, and send approved emails
from the user's mailbox. It should not imply that drafts will be created inside
Gmail or Outlook unless that provider-draft feature is added later.

## Sending Emails

### Outreach draft send

User-approved sends happen through:

```text
POST /api/projects/:uuid/outreach/drafts/:draftUuid/send
```

Handled by:

- `ProjectOutreachApiController.sendDraft`
- `sendOutreachDraft` in `project_outreach_service.ts`

The flow:

1. Load the draft, project vendor, and thread.
2. Choose the first connected inbox for the user using `getPreferredConnection`.
3. If a connection exists, call `sendOnBehalf(connection, { to, subject, body })`.
4. If no connection exists, send through the Envoy system mailbox with
   `OutreachMail` and Resend.
5. Record an outbound `Message`.
6. Mark the `OutreachDraft` as `sent`, storing the sent message uuid.
7. On error, mark the draft as `error` and store `last_error`.

### Thread replies

Thread replies use:

```text
POST /api/projects/:uuid/outreach/threads/:threadUuid/replies
```

Handled by:

- `ProjectOutreachApiController.replyToThread`
- `sendThreadReply` in `project_outreach_service.ts`

This is similar to outreach draft sending, but can include threading values:

- `inReplyTo`
- `references`
- `threadId`

### Inbox API reply path

There is also:

```text
POST /api/inbox/reply
```

Handled by:

- `InboxAPIController.sendReply`
- `sendReplyAndRecord` in `inbox_reply_service.ts`

This path requires a connected inbox and does not fall back to the Envoy system
mailbox.

## `envoy-email-service` Behavior

The email service is called by project management with a refreshed access token.

### Authentication between services

`src/index.ts` checks `EMAIL_SERVICE_API_KEY`:

- If unset, service-to-service auth is bypassed.
- If set, the value is treated as an AWS SSM Parameter Store name.
- The service loads the decrypted parameter and requires
  `Authorization: Bearer <token>`.

Project management adds this bearer token from its own `EMAIL_SERVICE_API_KEY`
environment variable when calling the service.

### Request contracts

`src/models/email.ts` currently defines:

```ts
export type EmailProvider = 'gmail'
```

`src/utils/request-validation.ts` rejects all providers except `gmail`.

### Inbox list

`POST /inbox/list`:

- Creates a Gmail OAuth client from the provided access token.
- Calls `gmail.users.messages.list`.
- Uses query `in:inbox`.
- Supports `afterDate`.
- Fetches metadata for `From`, `To`, `Subject`, and `Date`.
- Returns summaries with Gmail `id`, `threadId`, headers, date, and snippet.

### Inbox message detail

`POST /inbox/message`:

- Calls `gmail.users.messages.get`.
- Extracts headers and body text/html fallback.
- Returns body, sender/recipients, subject, date, `Message-ID`, and
  `References`.

Current gap: the project-management detail type expects `inReplyTo`, but the
email-service response model does not currently define or return it.

### Send on behalf

`POST /send-on-behalf`:

- Builds a plain-text MIME message.
- Adds `In-Reply-To` and `References` headers when present.
- Sends through `gmail.users.messages.send`.
- Passes Gmail `threadId` when supplied.
- Returns Gmail's message id.

## Important Current Gaps

- Microsoft is blocked in the web controller and unsupported in the email
  service.
- Provider-specific logic is split across both repos instead of isolated behind
  a clean provider interface.
- The email service does not support mailbox/folder selection, although project
  management tries to request it.
- Local Envoy drafts are not provider mailbox drafts. This is acceptable for the
  current product direction, but the UI and consent language must be explicit
  about that.
- Gmail direct fallback exists inside project management, bypassing the email
  service abstraction.
- Token columns are hidden from serialization but appear to be stored as plain
  text unless database-level encryption is supplied elsewhere.
- OAuth state is checked against the authenticated user, but it is not signed and
  does not appear to include a nonce or expiry.
- One-time registration consent is a product goal, but OAuth providers can still
  revoke or expire refresh tokens. The app needs a reconnect path and should not
  promise that authorization literally never expires.
- Microsoft sends through Graph may not return a provider message id from
  `sendMail`; sync/reconciliation will need to handle that.

## Open Questions and Concerns

### Authorization, consent, and terms

- Legal terms acceptance and provider OAuth consent are related but separate.
  Terms can document that Envoy will access and send email for the user, but
  Gmail and Microsoft still require technical OAuth consent before their APIs
  will allow mailbox access.
- One-time consent at registration is the right product flow, but we need to
  design the exception path for revoked, expired, admin-blocked, or insufficient
  OAuth grants.
- We should decide whether email access is mandatory for registration or only
  mandatory for consumers who want outreach automation. If it is mandatory, the
  fallback path for users who cannot grant Google/Microsoft permissions must be
  defined.
- Registration copy needs to be precise: "Envoy can view your mailbox, prepare
  local drafts, and send approved emails from your connected account" is safer
  than "Envoy can create drafts in your email account" while drafts remain local.
- We should store an auditable consent record in Envoy, separate from the OAuth
  token row: user, provider, email address, scopes, terms version, timestamp, IP,
  and user agent.
- We need a plan for scope upgrades. If a user previously authorized only
  `Mail.Read` and `Mail.Send`, then a future provider-draft feature requiring
  `Mail.ReadWrite` must trigger re-consent.

### Offline/background access

- Background access can work while the user is offline only while the stored
  refresh token remains valid and the provider still permits the app. Google and
  Microsoft both document refresh-token expiration/revocation cases.
- We need reconnect UX for failed refreshes: mark the connection as degraded,
  pause background sync/send for that connection, show a clear reconnect CTA, and
  avoid repeatedly retrying a known-invalid token.
- Microsoft refresh tokens should be rotated on each refresh response; the old
  refresh token should be replaced with the new one.
- For Google, we need to ensure the OAuth app is in production before relying on
  long-lived Gmail-scope refresh tokens. Testing-mode apps can receive refresh
  tokens that expire quickly.

### Security and compliance

- Mail scopes are sensitive/high-risk. We need to confirm whether Google app
  verification, security assessment, privacy policy updates, or Microsoft tenant
  admin consent are required before production.
- Access and refresh tokens should be encrypted at rest at the application or
  database layer. Hiding token columns from serialization is not enough.
- OAuth `state` should be signed, timestamped, and tied to a session nonce.
- We need least-privilege scopes. With local drafts, Gmail likely needs
  `gmail.readonly`, `gmail.send`, and `userinfo.email`; Microsoft likely needs
  `Mail.Read`, `Mail.Send`, `User.Read`, `offline_access`, and `openid`.
- We need a revocation/delete path that removes tokens and stops sync when a user
  disconnects, closes their account, or requests data deletion.

### Product behavior

- We should confirm whether Envoy is allowed to send emails automatically in the
  background after the user grants one-time consent, or whether every send still
  requires a user approval action in the UI. Current code requires user approval
  for sending local outreach drafts.
- We should define what happens when no connected inbox is available. Current
  behavior falls back to the Envoy system mailbox for project outreach, but that
  may conflict with a product requirement that all outreach must come from the
  customer's mailbox.
- Multiple inboxes are supported structurally, but `getPreferredConnection`
  simply picks the first one ordered by provider/email. We need a default sender
  setting if users can connect more than one mailbox.
- We should decide whether vendor replies should sync across all projects or
  only when a user opens a specific project's Outreach tab.
- We need to clarify how much historical mail should be read at first connect
  and whether sync should be limited by project vendors, date windows, or
  explicit search queries for data minimization.

### Provider abstraction

- Provider-specific API differences need to be normalized: Gmail `threadId`,
  Microsoft `conversationId`, RFC `Message-ID`, references, sent-folder behavior,
  pagination, body formats, and recipients.
- `envoy-email-service` must become the only mailbox API boundary. The Gmail
  direct fallback inside project management should be removed after the service
  supports provider-neutral folder/all-mail listing.
- The service contract should include mailbox/folder selection and pagination so
  project management does not need provider-specific workarounds.
- Microsoft Graph `sendMail` may not return a message id, so sent-message
  reconciliation may require later sent-folder sync rather than immediate id
  persistence.

### Operations and reliability

- Background sync needs a scheduler or worker model if we want vendor replies
  without requiring the user to open the project Outreach tab.
- Provider API quota/rate-limit handling needs backoff and per-connection
  isolation.
- We need clear observability for sync/send failures without logging message
  bodies or tokens.
- Tests should cover expired tokens, revoked tokens, insufficient scopes,
  provider outages, send success without provider message id, duplicate message
  prevention, and re-consent flows.

## Primary Provider References

- Google Gmail API scopes:
  https://developers.google.com/workspace/gmail/api/auth/scopes
- Google Gmail drafts guide:
  https://developers.google.com/workspace/gmail/api/guides/drafts
- Microsoft Graph permissions reference:
  https://learn.microsoft.com/en-us/graph/permissions-reference
- Microsoft Graph create and send mail:
  https://learn.microsoft.com/en-us/graph/outlook-create-send-messages
- Microsoft Graph create message:
  https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0
- Microsoft Graph sendMail:
  https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- Microsoft identity platform scopes and `offline_access`:
  https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc
- Google OAuth refresh token expiration:
  https://developers.google.com/identity/protocols/oauth2#expiration
- Microsoft identity platform refresh tokens:
  https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens

## Plan: Microsoft Support and Plug-and-Play Providers

### 1. Define provider contracts first

Add a provider interface in `envoy-email-service`, then route all provider calls
through a registry:

```ts
export interface EmailProviderAdapter {
  listMessages(input: ListMessagesInput): Promise<ListMessagesResult>
  getMessage(input: GetMessageInput): Promise<GetMessageResult>
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>
  createDraft?(input: CreateDraftInput): Promise<CreateDraftResult>
}
```

Recommended normalized provider ids:

```ts
export type EmailProvider = 'gmail' | 'microsoft'
```

Recommended common capabilities:

- `readMessages`
- `sendMessages`
- `mailboxSelection`
- `threadedSend`
- `createProviderDrafts` as an optional future capability, not a requirement for
  the current local-draft approach

Project management should have a matching OAuth/provider-auth registry:

```ts
export interface InboxAuthProvider {
  getAuthorizationUrl(input: AuthUrlInput): string
  exchangeCode(input: ExchangeCodeInput): Promise<ConnectedMailboxTokens>
  refresh(input: RefreshInput): Promise<RefreshedMailboxTokens>
}
```

This removes provider-specific branches from controllers and keeps Gmail,
Microsoft, and future providers behind the same boundary.

### 2. Make `envoy-email-service` provider-neutral

Required changes:

- Update `EmailProvider` to include `microsoft`.
- Preserve and validate `mailbox` on `InboxListRequest`.
- Add `inReplyTo` to `InboxMessage`.
- Move Gmail logic into `GmailEmailProviderAdapter`.
- Add `MicrosoftEmailProviderAdapter`.
- Replace hard-coded Gmail calls in `inboxList`, `inboxGetMessage`, and
  `sendOnBehalf` with registry dispatch.
- Update tests so unknown providers still fail, but both `gmail` and
  `microsoft` pass validation.

Microsoft adapter behavior:

- List messages through Microsoft Graph mail folders. Use stable folder ids such
  as `inbox` and `sentitems` rather than display names.
- Fetch message details from Graph and normalize sender, recipients, body,
  timestamps, internet message id, references, and conversation id.
- Send through Graph `sendMail`.
- If Graph send does not return a sent message id, persist an empty provider id
  and rely on the next sent-folder sync to reconcile.
- Implement provider draft creation only if product requirements want drafts to
  appear in the user's Outlook Drafts folder.

### 3. Keep drafts local by default

Product direction:

- Drafts are stored in Envoy until the user sends them.
- Sent emails are stored in vendor conversations as outbound `Message` records.
- Provider Drafts folders are not part of the Microsoft launch requirement.

Permission impact:

- Microsoft scopes: `Mail.Read`, `Mail.Send`, `User.Read`, `offline_access`,
  and `openid`.
- Gmail scopes: `gmail.readonly`, `gmail.send`, and `userinfo.email`.
- Do not request Microsoft `Mail.ReadWrite` or Gmail `gmail.compose` only for
  local draft storage. Add those later only if Envoy needs to create provider
  mailbox drafts.

Registration consent language should say that Envoy can view email, prepare
local drafts, and send approved messages from the connected account. Avoid
language that implies provider Drafts-folder creation unless that capability is
implemented.

### 4. Enable Microsoft inbox OAuth in project management

After the email service supports Microsoft:

- Remove the Microsoft blocks in `InboxController.connect` and
  `InboxController.callback`.
- Route both Gmail and Microsoft through the provider-auth registry.
- Confirm `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` are configured.
- Confirm the Azure app registration has redirect URI
  `APP_URL/inbox/callback`.
- Request the final selected scopes from step 3.
- Store Microsoft connections in the existing `user_inbox_connections` table.
- Keep `provider: 'microsoft'` in records and API requests.

### 5. Move consent into registration/onboarding

The goal is to remove the separate profile button as the primary way to grant
mail access.

Recommended UX and flow:

- Registration asks the user to connect their email provider as part of account
  setup and accept Envoy's email-use terms in the same flow.
- The user chooses Gmail or Microsoft, or the app suggests one from their email
  domain.
- After account creation, project management immediately redirects to
  `/inbox/connect?provider=<provider>&returnTo=<next_step>`.
- `/inbox/callback` stores the connection and redirects to the intended next
  step, such as `/onboarding/project` or `/dashboard`.
- The Account page keeps the connected-account list and disconnect action, but
  does not remain the primary CTA for first-time consent.

Implementation details:

- Add `emailProvider` and `connectEmail` to the registration UI state.
- Extend the registration validator if the provider selection is submitted with
  the form.
- Store a signed, expiring `returnTo` value in session before redirecting to the
  provider.
- For password registration, redirect to inbox OAuth after the user is created
  and logged in.
- For social registration, either run a second inbox OAuth redirect after login
  or replace Ally for registration with the new provider-auth flow that requests
  both identity and mail scopes in one consent screen.
- Keep login separate from mailbox consent for existing users unless they are in
  an onboarding flow that requires connection.
- Treat registration-time consent as the one-time happy path, while still
  implementing reconnect handling for provider revocation, token expiration,
  admin-policy failures, and scope upgrades.

### 6. Harden authorization and token storage

Recommended before broad rollout:

- Sign and timestamp OAuth `state`.
- Include a session nonce and verify it in the callback.
- Encrypt access and refresh tokens at the application layer or with a managed
  database encryption strategy.
- Add explicit handling for revoked refresh tokens and provider re-consent.
- Track `scopes` and provider capabilities per connection so the UI can require
  re-consent when new capabilities are added.

### 7. Update outreach sync to use provider capabilities only

Required cleanup:

- Remove Gmail direct fallback from `project_outreach_service.ts` once
  `envoy-email-service` supports `mailbox` and `anywhere` listing.
- Normalize inbox/sent/all-mail listing through the email-service adapter.
- Return enough metadata to match Microsoft replies reliably:
  provider message id, provider thread/conversation id, internet message id,
  references, sender, recipients, and timestamp.
- Make sent-folder sync resilient to providers that delay sent-message
  availability after API sends.

### 8. Test and rollout

Add or update tests in both repos:

- Email-service validation accepts Gmail and Microsoft.
- Email-service routes dispatch by provider.
- Gmail adapter preserves existing behavior.
- Microsoft adapter maps Graph responses into the shared message shape.
- Mailbox selection works for inbox, sent, and all/anywhere modes.
- Project-management callback stores Gmail and Microsoft connections.
- Registration redirects into inbox consent and returns to the correct next step.
- Outreach sync and send paths work with both providers.
- Re-consent is required when a connection lacks a required provider capability.

Rollout order:

1. Provider interfaces and test coverage.
2. Microsoft email-service adapter behind tests.
3. Project-management Microsoft OAuth enablement.
4. Registration/onboarding consent redirect.
5. Optional provider-draft creation.
6. Remove the Account-page first-time connection CTA after registration consent
   is stable.
