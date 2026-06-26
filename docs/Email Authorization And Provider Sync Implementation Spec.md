# Email Authorization And Provider Sync Implementation Spec

Last reviewed: 2026-06-26

Related background: `docs/email-handling-overview.md`

## Goal

Make connected customer email a mandatory part of registration and support Gmail
and Microsoft end to end through a clean provider abstraction. Envoy must be able
to read vendor-related messages, prepare local drafts, send approved messages
from the user's connected mailbox, and sync vendor replies in the background via
provider push notifications.

## Decisions

- Email authorization is mandatory for all users.
- If provider authorization fails, registration fails.
- Email/password registration is out of scope.
- Registration uses a single combined OAuth flow when possible:
  identity/profile scopes plus mail scopes in one provider consent.
- The connected mailbox address must match the email address used for the Envoy
  account.
- Users have exactly one main connected inbox.
- Drafts remain local in Envoy until sent.
- Sending still requires user approval in the UI, such as an `Approve & Send`
  button.
- Provider-side Gmail/Outlook Drafts folder creation is out of scope.
- Failed sends stay in `error` state. Do not fall back to the Envoy system
  mailbox.
- Vendor replies sync in the background.
- Inbound vendor replies auto-create local reply drafts.
- Both personal Microsoft accounts and work/school Microsoft accounts should be
  supported.
- Use the Microsoft `common` endpoint, while still handling tenant/admin consent
  failures.
- `envoy-email-service` is the only service that talks directly to Gmail and
  Microsoft mailbox APIs.
- Project management stores OAuth tokens and passes fresh access tokens to the
  email service.
- Token encryption should use the existing Adonis encryption service backed by
  `APP_KEY` for the first implementation. This adds no new infrastructure.

## Non-Goals

- Email/password registration.
- Multiple connected inboxes per user.
- Provider-side draft creation.
- Automatic outbound sending without a user approval action.
- Keeping a user active in the app after they disconnect or lose email
  authorization.
- Building a full external email client UI. Envoy only surfaces vendor-related
  conversations.

## Provider Scopes

### Gmail

Request:

- `openid`
- `userinfo.email`
- `userinfo.profile`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`

OAuth parameters:

- `access_type=offline`
- `prompt=consent`

Do not request `gmail.compose` or `gmail.modify` for this phase because drafts
are local and label/message mutation is not required.

### Microsoft

Use the v2 `common` endpoint:

```text
https://login.microsoftonline.com/common/oauth2/v2.0/authorize
```

Request:

- `openid`
- `profile`
- `email`
- `offline_access`
- `User.Read`
- `Mail.Read`
- `Mail.Send`

The Azure app registration must support personal Microsoft accounts and
organizational accounts. `common` does not bypass tenant policies; work/school
accounts can still require admin consent or block user consent.

Do not request `Mail.ReadWrite` for this phase because Outlook Drafts folder
creation is out of scope.

## Architecture

### Responsibilities

`envoy-project-management` owns:

- Registration and login.
- Combined OAuth start/callback.
- User account creation.
- Required mailbox connection state.
- Encrypted token storage.
- Token refresh.
- Consent audit records.
- Vendor matching.
- Message persistence.
- Local outreach/reply drafts.
- Send approval UI.
- Sync event queue and processing.
- Reauth-required UX.

`envoy-email-service` owns:

- Gmail provider adapter.
- Microsoft provider adapter.
- Provider message listing/search/get/send operations.
- Provider push setup/renewal/removal operations.
- Gmail Pub/Sub webhook endpoint.
- Microsoft Graph webhook and lifecycle endpoints.
- Normalizing provider notifications.
- Forwarding normalized notifications to project management.

### Event Flow

Gmail push:

```text
Gmail -> Google Pub/Sub -> envoy-email-service /webhooks/gmail/pubsub
  -> normalized event -> SQS email sync queue
  -> project-management sync worker -> email-service provider APIs
  -> vendor conversations / local reply drafts
```

Microsoft push:

```text
Microsoft Graph -> envoy-email-service /webhooks/microsoft/graph
  -> normalized event -> SQS email sync queue
  -> project-management sync worker -> email-service provider APIs
  -> vendor conversations / local reply drafts
```

Provider push wakes the system. Sync still needs an internal processor because
Graph and Pub/Sub webhooks should acknowledge quickly, and provider APIs can be
slow or rate-limited.

### Queue Infrastructure

Use SQS for provider notification and sync work:

- Add standard SQS queue `envoy-email-sync-events`.
- Add dead-letter queue `envoy-email-sync-events-dlq`.
- Email-service webhook Lambda publishes normalized events to SQS.
- A project-management sync worker Lambda consumes SQS and owns all persistence.
- SQS messages are at-least-once; project-management sync must be idempotent.

Use standard SQS, not FIFO, for v1. Mail sync should tolerate out-of-order
notifications by fetching provider state and de-duplicating persisted messages.

## Data Model

### `user_inbox_connections`

Alter existing table.

Add:

- `uuid uuid unique not null`
- `status varchar(32) not null default 'active'`
  - `active`
  - `reauth_required`
  - `disconnected`
- `is_primary boolean not null default true`
- `provider_user_id varchar(255) null`
- `scopes text null`
- `token_encryption_version varchar(32) not null default 'adonis_app_key_v1'`
- `last_sync_at timestamptz null`
- `last_sync_error text null`
- `reauth_reason text null`
- `reauth_required_at timestamptz null`
- `disconnected_at timestamptz null`
- `provider_cursor text null`
  - Gmail: latest known `historyId`.
  - Microsoft: optional delta cursor later; v1 may not need it.
- `watch_status varchar(32) not null default 'not_configured'`
  - `active`
  - `renewal_required`
  - `not_configured`
  - `error`
- `watch_expires_at timestamptz null`
- `provider_subscription_id varchar(255) null`
- `subscription_client_state varchar(255) null`
- `subscription_expires_at timestamptz null`

Keep:

- `access_token`
- `refresh_token`
- `access_token_expires_at`

Change behavior:

- Store encrypted token payloads in the existing token columns.
- Enforce one main inbox per user in application code and, if practical, via a
  partial unique index on active/primary rows.

Recommended indexes:

- `(user_uuid, status)`
- `(provider, email, status)`
- `(provider_subscription_id)`
- `(watch_expires_at)`
- `(subscription_expires_at)`

### `email_authorization_consents`

New audit table.

Columns:

- `id`
- `uuid`
- `user_uuid`
- `provider`
- `email`
- `provider_user_id`
- `scopes`
- `terms_version`
- `consent_text`
- `ip_address`
- `user_agent`
- `created_timestamp`

Purpose:

- Records the user's Envoy-side acceptance that Envoy can view email, prepare
  local drafts, and send approved messages from the connected account.
- Does not replace provider OAuth consent.

### SQS email sync event payload

SQS message body:

```ts
export interface EmailSyncEventMessage {
  eventId: string
  provider: 'gmail' | 'microsoft'
  eventType:
    | 'gmail_history'
    | 'microsoft_message_created'
    | 'microsoft_message_updated'
    | 'subscription_renewal'
    | 'manual_backfill'
  connectionUuid?: string
  email?: string
  providerSubscriptionId?: string
  providerMessageId?: string
  providerThreadId?: string
  providerCursor?: string
  occurredAt: string
  payload?: Record<string, unknown>
}
```

SQS message attributes:

- `provider`
- `eventType`
- `connectionUuid`, when known

Project management must treat `eventId` as a de-duplication key at the
processing layer. Because SQS can deliver messages more than once, DB writes
must also remain idempotent by provider message id and conversation/thread ids.

### Message persistence

Keep using `envoy_schema.messages`.

Required behavior:

- Persist outbound approved sends as `direction = 'outbound'`.
- Persist inbound vendor messages as `direction = 'inbound'`.
- Store provider ids:
  - `provider_message_id`
  - `provider_thread_id`
  - `message_id_header`
  - `references_header`
- Do not persist non-vendor mail.
- De-duplicate by provider and provider message id.

## Token Encryption

Use Adonis encryption for v1.

Rationale:

- `APP_KEY` already exists and powers Adonis encryption.
- No KMS, SSM, schema type change, or new infrastructure is required.
- Existing token columns can store encrypted strings.

Implementation:

- Add a small `oauth_token_encryption_service.ts`.
- Use `@adonisjs/core/services/encryption`.
- Store encrypted token strings in `access_token` and `refresh_token`.
- Decrypt only inside project management, immediately before refresh or before
  sending an access token to the email service.
- Never log decrypted tokens.
- Add `token_encryption_version = 'adonis_app_key_v1'`.

Tradeoff:

- Rotating `APP_KEY` without a migration/re-encryption step will make stored
  tokens undecryptable. This is acceptable for the minimal-infra first version,
  but the future hardening path is a dedicated `EMAIL_TOKEN_ENCRYPTION_KEY` or
  KMS-backed envelope encryption.

## Registration And Auth Flow

### Registration page

Replace separate profile-based inbox connection with registration-time consent.

UI requirements:

- Show provider buttons:
  - `Continue with Google`
  - `Continue with Microsoft`
- Include a required terms/authorization checkbox:
  - `I authorize Envoy to view my email, prepare local drafts, and send approved messages from my connected account.`
- Disable provider buttons until the checkbox is checked.
- Do not show email/password registration.

### OAuth start

Route:

```text
GET /auth/:provider
```

Provider must be:

- `google`
- `microsoft`

The OAuth request must include both identity and mail scopes.

State must include:

- provider
- terms version
- return path
- nonce
- issued-at timestamp
- flow type, such as `registration`

State must be signed and stored/validated against session.

### OAuth callback

Route:

```text
GET /auth/:provider/callback
```

Callback behavior:

1. Validate provider.
2. Validate signed state, timestamp, and session nonce.
3. Exchange code for access/refresh tokens.
4. Fetch provider identity profile.
5. Resolve mailbox email.
6. Require mailbox email to match account email.
   - For new users, the provider email becomes the account email.
   - For returning users, the provider email must match the existing user email.
7. Create or update user.
8. Create or update a single primary `UserInboxConnection`.
9. Encrypt and store tokens.
10. Store consent audit record.
11. Configure provider push watch/subscription through `envoy-email-service`.
12. Queue an initial vendor-only backfill event.
13. Log the user in.
14. Redirect to onboarding/dashboard.

Failure behavior:

- If OAuth fails, show registration failure and do not create an active session.
- If user creation succeeds but mailbox setup fails, mark the user inactive or
  incomplete and require reconnect before the app is usable.
- If provider email does not match an existing user's email, reject login.

### Reauth flow

When refresh fails, watch renewal fails due to auth, or provider reports
authorization failure:

- Mark connection `reauth_required`.
- Stop background sync and sends for that connection.
- Keep vendor conversations and synced messages.
- On next login or request, redirect the user into provider OAuth.
- After success, update tokens, restore `status = active`, renew provider
  watch/subscription, and resume sync.

### Disconnect flow

Because email is mandatory, user disconnect is effectively replace/reconnect.

Recommended behavior:

1. Ask for confirmation.
2. Stop provider watch/subscription when possible.
3. Delete encrypted tokens or mark the row `disconnected`.
4. Keep vendor conversation history indefinitely.
5. Immediately require reconnect before the app remains usable.

## Provider Interfaces

### Project management OAuth provider interface

Create provider-specific OAuth adapters in project management:

```ts
export interface InboxAuthProvider {
  provider: 'gmail' | 'microsoft'
  getAuthorizationUrl(input: AuthUrlInput): string
  exchangeCode(input: ExchangeCodeInput): Promise<ConnectedMailboxTokens>
  refresh(input: RefreshInput): Promise<RefreshedMailboxTokens>
  getProfile(input: ProviderProfileInput): Promise<ProviderProfile>
}
```

Normalized output:

```ts
export interface ConnectedMailboxTokens {
  provider: 'gmail' | 'microsoft'
  providerUserId: string
  email: string
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string
}
```

### Email-service mail provider interface

Create provider-specific mail adapters in `envoy-email-service`:

```ts
export interface EmailProviderAdapter {
  provider: 'gmail' | 'microsoft'
  listMessages(input: ListMessagesInput): Promise<ListMessagesResult>
  searchVendorMessages(input: SearchVendorMessagesInput): Promise<ListMessagesResult>
  listChangedMessages(input: ListChangedMessagesInput): Promise<ListMessagesResult>
  getMessage(input: GetMessageInput): Promise<GetMessageResult>
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>
  setupWatch(input: SetupWatchInput): Promise<WatchResult>
  renewWatch(input: RenewWatchInput): Promise<WatchResult>
  stopWatch(input: StopWatchInput): Promise<void>
}
```

Provider-normalized message shape:

```ts
export interface ProviderMessage {
  id: string
  threadId: string | null
  internetMessageId: string | null
  references: string | null
  inReplyTo: string | null
  from: string
  to: string
  cc?: string
  subject: string
  body: string
  date: string
  snippet?: string
}
```

Provider-normalized send result:

```ts
export interface SendMessageResult {
  messageId: string | null
  threadId: string | null
}
```

Microsoft `sendMail` may return no message id. In that case return
`messageId: null` and rely on sent-folder sync to reconcile later.

## Email-Service API Changes

Existing endpoints remain:

- `POST /send-on-behalf`
- `POST /inbox/list`
- `POST /inbox/message`

Add:

```text
POST /inbox/search-vendor-messages
POST /inbox/changes
POST /watches/setup
POST /watches/renew
POST /watches/stop
POST /webhooks/gmail/pubsub
POST /webhooks/microsoft/graph
POST /webhooks/microsoft/lifecycle
```

### Auth

Internal project-management-to-email-service calls keep using
`Authorization: Bearer <EMAIL_SERVICE_API_KEY>`.

Provider webhook endpoints cannot use that bearer token because providers call
them directly. They must validate provider payloads:

- Gmail Pub/Sub push should be accepted only from the configured Pub/Sub push
  setup and should validate the Pub/Sub envelope as far as practical.
- Microsoft Graph webhook must handle validation token challenges and validate
  `clientState` on notifications.

When publishing normalized events to SQS, email-service must use an IAM role
with permission to `sqs:SendMessage` on `envoy-email-sync-events`. The
project-management sync worker Lambda must use an IAM role with permission to
consume from the queue and write to the project-management database or internal
API.

## Provider Push Details

### Gmail

Setup:

- Call Gmail `users.watch`.
- Use one configured Google Pub/Sub topic.
- Store returned `historyId` in `provider_cursor`.
- Store returned expiration in `watch_expires_at`.

Webhook:

- Pub/Sub push sends a message whose data contains Gmail `emailAddress` and
  `historyId`.
- Email-service decodes the message and publishes an SQS message:
  - provider: `gmail`
  - email
  - provider cursor/history id
  - event type: `gmail_history`

Sync processing:

- Project management finds the active connection by provider/email.
- Project management calls email-service `/inbox/changes` with the decrypted
  access token and previous cursor.
- Gmail adapter calls `history.list`.
- For changed message ids, fetch details and persist only vendor-related mail.
- Update `provider_cursor`.

Renewal:

- Gmail watches expire. Schedule renewal before `watch_expires_at`.
- If renewal fails due to auth, mark `reauth_required`.

### Microsoft

Setup:

- Create Microsoft Graph change-notification subscriptions for mail messages.
- Use `common` for OAuth, but Graph API calls use `https://graph.microsoft.com`.
- Resource should target messages in the mailbox, starting with inbox messages.
  Include sent-folder sync through periodic/vendor search because sendMail may
  not return a message id.
- Use signed compact `clientState` that identifies the connection and can be
  verified by email-service without a database lookup.
- Store:
  - subscription id
  - client state
  - expiration

Webhook:

- Graph first sends validation token challenges. Email-service must return the
  raw validation token.
- For notifications, email-service validates `clientState`.
- Email-service publishes a normalized SQS message:
  - provider: `microsoft`
  - connection uuid or subscription id
  - provider message id if present
  - provider thread/conversation id if present
  - event type such as `microsoft_message_created`

Sync processing:

- Project management finds the active connection by subscription id or
  connection uuid.
- It calls email-service `/inbox/message` for the provider message id when
  available.
- If notification data is incomplete, queue a narrow vendor sync.
- Persist only vendor-related mail.

Renewal:

- Microsoft Graph subscriptions expire and must be renewed.
- Schedule renewal before `subscription_expires_at`.
- If renewal fails due to auth, mark `reauth_required`.

## Sync Behavior

### Vendor-only scope

Envoy should display and store vendor-related mail only.

A message is vendor-related if:

- The counterparty email matches an active vendor listing attached to one of the
  user's projects.
- Or the message belongs to an existing vendor conversation by provider thread id
  or RFC `Message-ID`/`References`.

Do not persist unrelated mailbox messages.

### Initial backfill

After first connection:

1. Queue a `manual_backfill` event.
2. Build the user's active vendor email set.
3. Call email-service `searchVendorMessages`.
4. Search both received and sent mail where practical.
5. Persist matching messages to vendor conversations.
6. De-duplicate by provider message id and RFC headers.

No fixed age limit is required by product. For API safety, the implementation
may process in pages and stop after configurable per-vendor/page limits, then
continue in later jobs.

### Ongoing notification sync

For each provider event:

1. Resolve connection.
2. Refresh access token if needed.
3. Fetch changed or referenced messages via email-service.
4. Filter to vendor-related messages.
5. Persist new messages.
6. For new inbound vendor messages, auto-create a local reply draft.
7. Update connection sync metadata.

### Periodic repair sync

Push notifications are not a perfect delivery guarantee. Add a periodic repair
job:

- Renew watches/subscriptions.
- Sync vendor-related mail for active connections.
- Let SQS retry failed sync messages with redrive to the DLQ.
- Mark stale auth failures as `reauth_required`.

## Sending Behavior

### Local drafts

Drafts remain in `outreach_drafts`.

User sends through existing UI actions:

- `POST /api/projects/:uuid/outreach/drafts/:draftUuid/send`
- `POST /api/projects/:uuid/outreach/threads/:threadUuid/replies`

Required changes:

- Require active primary inbox.
- Remove system-mailbox fallback for user outreach sends.
- If no active inbox or send fails, keep the draft/thread reply in error state.
- Persist sent email to vendor conversation as outbound `Message`.
- If provider returns no message id, persist the outbound message with null
  provider id and reconcile on later sent-folder sync when possible.

### Reply drafts

When a new inbound vendor message is persisted:

- If there is already an active local draft for the thread, do not create a
  duplicate.
- Otherwise call the reasoning engine with project, vendor, and recent thread
  context.
- Save a local `OutreachDraft` for user review.
- Do not send automatically.

## UI Changes

### Registration

- Replace email/password form as the primary registration path.
- Show required email-use terms checkbox.
- Show Google and Microsoft buttons.
- Provider button starts the combined OAuth flow.
- Registration fails if provider consent fails.

### Account page

- Keep current connected inbox section, but change purpose:
  - Show the single main inbox.
  - Show status: active, reauth required, disconnected.
  - Offer reconnect/replace inbox.
  - Do not present connection as optional profile polish.

### Reauth gate

If a signed-in user has no active primary inbox:

- Redirect to a required reconnect page.
- Explain that Envoy requires a connected email account.
- Preserve intended destination.
- After successful reauth, continue.

### Outreach

- Display sender mode as connected inbox only.
- Disable send if inbox status is not active.
- Keep failed sends in error state with retry/revise options.

## Routes

Project management:

```text
GET  /register
GET  /auth/:provider
GET  /auth/:provider/callback
POST /inbox/disconnect
```

Project management worker:

- Consumes `envoy-email-sync-events` from SQS.
- Processes one message idempotently.
- Deletes the SQS message only after successful processing.
- Lets SQS retry and eventually move failed messages to the DLQ.

Email service:

```text
POST /send-on-behalf
POST /inbox/list
POST /inbox/message
POST /inbox/search-vendor-messages
POST /inbox/changes
POST /watches/setup
POST /watches/renew
POST /watches/stop
POST /webhooks/gmail/pubsub
POST /webhooks/microsoft/graph
POST /webhooks/microsoft/lifecycle
```

## Environment Variables

Project management:

- `APP_KEY` existing, used for Adonis encryption v1.
- `EMAIL_SERVICE_URL`
- `EMAIL_SERVICE_API_KEY`
- `EMAIL_SYNC_QUEUE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `EMAIL_TERMS_VERSION`

Email service:

- `EMAIL_SERVICE_API_KEY`
- `EMAIL_SYNC_QUEUE_URL`
- `GMAIL_PUBSUB_TOPIC`
- `GMAIL_PUBSUB_AUDIENCE` if push JWT validation is configured
- `MICROSOFT_GRAPH_NOTIFICATION_URL`
- `MICROSOFT_GRAPH_LIFECYCLE_URL`
- `MICROSOFT_GRAPH_CLIENT_STATE_SECRET`

## Implementation Phases

### Phase 1: Data, encryption, and provider contracts

Tasks:

- Add migrations for connection metadata, consent audit, and sync events.
- Add token encryption/decryption service using Adonis encryption.
- Backfill existing token rows if needed.
- Add project-management OAuth provider registry.
- Add email-service mail provider registry.
- Update email-service request validation to accept `gmail` and `microsoft`.

Acceptance criteria:

- Existing Gmail connections can be read after token encryption migration.
- New token writes are encrypted.
- Invalid provider ids are rejected.
- Unit tests cover encryption round trip and invalid ciphertext handling.

### Phase 2: Combined registration OAuth

Tasks:

- Replace registration form with provider-based flow and required terms
  checkbox.
- Request identity and mail scopes in one OAuth flow.
- Validate signed state and nonce.
- Create/update user and primary inbox connection atomically where practical.
- Require provider email to match account email.
- Store consent audit record.
- Add reauth-required gate.

Acceptance criteria:

- A new Google user can register only after accepting terms and granting mail
  scopes.
- A new Microsoft user can register with personal or work/school account when
  provider policy allows it.
- OAuth cancellation or denied scopes prevents registration completion.
- Provider email mismatch fails.
- User without active primary inbox cannot use the app.

### Phase 3: Email-service Gmail/Microsoft adapters

Tasks:

- Move Gmail logic into adapter.
- Add Microsoft Graph adapter.
- Normalize message shapes.
- Implement provider-neutral send.
- Implement provider-neutral search/list/get/changes.
- Remove direct Gmail fallback from project management once email-service
  supports the needed list/search behavior.

Acceptance criteria:

- Gmail send/list/get still works.
- Microsoft send/list/get works.
- Microsoft send with no returned message id is handled.
- Vendor-only search works for both providers.
- Tests cover provider dispatch and normalized outputs.

### Phase 4: Push notification setup and renewal

Tasks:

- Add email-service watch setup/renew/stop endpoints.
- Configure Gmail `users.watch` with Pub/Sub.
- Configure Microsoft Graph subscriptions with validation handling.
- Store watch/subscription metadata on `user_inbox_connections`.
- Add renewal processor.

Acceptance criteria:

- Successful registration configures provider push.
- Gmail Pub/Sub notification creates a sync event.
- Microsoft Graph notification creates a sync event.
- Subscription validation challenge succeeds.
- Expiring watches/subscriptions renew before expiry.
- Auth failures mark connection `reauth_required`.

### Phase 5: Background sync processing

Tasks:

- Implement SQS email sync worker.
- Implement initial vendor-only backfill.
- Implement ongoing provider event sync.
- Implement retry/backoff.
- Persist only vendor-related messages.
- Auto-create local reply drafts for inbound vendor messages.

Acceptance criteria:

- Vendor messages received while the user is offline appear in vendor
  conversations.
- Non-vendor messages are ignored and not persisted.
- Duplicate provider notifications do not create duplicate messages.
- Inbound vendor replies create at most one active local draft per thread.
- Existing vendor conversation data remains the source for displayed previously
  sent/received mail.

### Phase 6: Send path hardening

Tasks:

- Require active primary inbox before sending.
- Remove Envoy system mailbox fallback from project outreach sends.
- Keep drafts in error state on send failure.
- Persist outbound messages after approved sends.
- Reconcile sent messages when provider id is unavailable.

Acceptance criteria:

- User approval button sends through connected inbox.
- Failed send leaves draft editable with visible error.
- No connected inbox blocks sending.
- Sent email appears in the vendor conversation.

### Phase 7: UI polish and operational safeguards

Tasks:

- Update account page to show primary inbox and reauth status.
- Add reconnect/replace flow.
- Add logs/metrics for webhook receipt, sync events, send failures, and renewal.
- Ensure message bodies and tokens are not logged.
- Add admin/debug views or commands for stuck sync events.

Acceptance criteria:

- Reauth-required users are guided through reconnect.
- Operators can identify failed syncs without reading email contents.
- Disconnect stops provider watch/subscription and requires reconnect.

## Testing Plan

Project management unit/functional tests:

- OAuth state signing and nonce validation.
- Provider email match requirement.
- Registration fails on denied consent.
- Registration stores consent audit.
- Token encryption/decryption.
- Reauth-required gate.
- Single active primary inbox enforcement.
- SQS sync event payload validation.
- SQS worker idempotency and retry-safe failure behavior.
- Vendor-only filtering.
- Duplicate message prevention.
- Auto-reply draft creation.
- Send failure keeps draft in error state.

Email-service tests:

- Provider validation accepts Gmail and Microsoft.
- Unknown providers fail.
- Gmail adapter maps API responses.
- Microsoft adapter maps Graph responses.
- Microsoft send result with no id is accepted.
- Gmail Pub/Sub payload normalization.
- Microsoft validation token response.
- Microsoft clientState validation.
- Watch setup/renew/stop provider dispatch.
- SQS event publishing payload and message attributes.

End-to-end tests:

- Google registration through combined OAuth.
- Microsoft registration through combined OAuth.
- Gmail push notification to vendor conversation.
- Microsoft Graph notification to vendor conversation.
- Offline vendor reply creates local draft.
- User-approved send persists outbound message.
- Reauth-required flow after simulated refresh failure.

## Operational Notes

- Gmail watches expire and must be renewed. Google recommends renewing before
  expiration; treat daily renewal as the safe operational target.
- Microsoft Graph subscriptions expire and must be renewed before expiration.
- Provider push notifications are a trigger, not the only source of truth.
  Periodic repair sync remains required.
- Work/school Microsoft accounts may require tenant admin consent even when
  using `common`.
- Google sensitive/restricted scope verification may be required before
  production.
- Because token encryption uses `APP_KEY` in v1, APP_KEY rotation requires a
  token re-encryption or forced reauth plan.

## Source References

- Email handling overview:
  `docs/email-handling-overview.md`
- Gmail push notifications:
  https://developers.google.com/workspace/gmail/api/guides/push
- Gmail scopes:
  https://developers.google.com/workspace/gmail/api/auth/scopes
- Google OAuth refresh token expiration:
  https://developers.google.com/identity/protocols/oauth2#expiration
- Microsoft identity platform endpoints:
  https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
- Microsoft identity platform refresh tokens:
  https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens
- Microsoft Graph change notifications:
  https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
- Microsoft Outlook change notifications:
  https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview
- Microsoft Graph subscription resource:
  https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0
