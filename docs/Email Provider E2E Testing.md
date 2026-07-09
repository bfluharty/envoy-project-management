# Email Provider E2E Testing

Use this checklist to validate Google and Microsoft registration, connected inbox
status, approved sends, provider push notifications, background sync, and
reauth/reconnect behavior.

## Current Status

The email authorization and provider sync spec is code-complete across
`envoy-project-management`, `envoy-email-service`, and infrastructure.

Treat the system as production-ready only after the deployed dev environment
passes the tests below for both Gmail and Microsoft. Live provider behavior still
depends on external configuration: OAuth app settings, Google Pub/Sub,
Microsoft Graph webhook reachability, SQS permissions, and provider/tenant
consent policies.

## Prerequisites

### Project Management

Required environment:

- `APP_URL`
- `APP_KEY`
- `EMAIL_SERVICE_URL`
- `EMAIL_SERVICE_API_KEY`
- `EMAIL_SYNC_QUEUE_URL`
- `EMAIL_SYNC_DLQ_URL`
- `EMAIL_TERMS_VERSION`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`

For local testing without protected email-service calls, `EMAIL_SERVICE_API_KEY`
may be blank. For deployed testing, it must resolve to the same secret used by
the email service.

### Email Service

Required environment:

- `EMAIL_SERVICE_API_KEY`
- `EMAIL_SYNC_QUEUE_URL`
- `GMAIL_PUBSUB_TOPIC`
- `MICROSOFT_GRAPH_NOTIFICATION_URL`
- `MICROSOFT_GRAPH_LIFECYCLE_URL`
- `MICROSOFT_GRAPH_CLIENT_STATE_SECRET`

In AWS, `EMAIL_SERVICE_API_KEY`, `GMAIL_PUBSUB_TOPIC`, and
`MICROSOFT_GRAPH_CLIENT_STATE_SECRET` are SSM parameter names resolved by the
email service. For local direct values, use the current local behavior carefully:
`GMAIL_PUBSUB_TOPIC` and `MICROSOFT_GRAPH_CLIENT_STATE_SECRET` support raw local
values, while `EMAIL_SERVICE_API_KEY` currently expects an SSM parameter name if
set.

### Provider Configuration

Google OAuth app:

- Authorized redirect URI: `${APP_URL}/auth/google/callback`
- Gmail API enabled.
- OAuth consent includes Gmail read/send scopes.

Microsoft app registration:

- Authorized redirect URI: `${APP_URL}/auth/microsoft/callback`
- Supported account types include personal and organizational accounts.
- API permissions include `User.Read`, `Mail.Read`, `Mail.Send`, and
  `offline_access`.

Provider push:

- Gmail Pub/Sub topic exists for the environment.
- Gmail Pub/Sub push subscription targets the deployed email-service
  `/webhooks/gmail/pubsub` URL.
- Microsoft Graph notification URL targets
  `/webhooks/microsoft/graph`.
- Microsoft Graph lifecycle URL targets
  `/webhooks/microsoft/lifecycle`.
- Microsoft webhook URLs are publicly reachable over HTTPS.

SQS:

- Main queue and DLQ exist.
- Email service has `sqs:SendMessage` on the main queue.
- Project-management worker has receive/delete/send/get-attributes permissions
  on the main queue and get-attributes permission on the DLQ.

## Baseline Checks

Run from `envoy-project-management`:

```bash
npm run typecheck
npm run build
node ace list
```

Confirm the command list includes:

- `email:sync-events`
- `email:sync-diagnostics`
- `email:watches:renew`

Run from `envoy-email-service`:

```bash
npm test
npm run build
```

Run from `envoy-infrastructure`:

```bash
npm run build
```

## Dev Environment Smoke Tests

### 1. Queue Diagnostics

Run:

```bash
node ace email:sync-diagnostics
```

Expected:

- Main queue is configured.
- DLQ is configured.
- Counts are visible without reading message bodies.
- No credential or permission error is returned.

### 2. Email Service Health

Call the deployed email-service health endpoint:

```bash
curl -i "$EMAIL_SERVICE_URL/health"
```

Expected:

- HTTP `200`
- JSON body includes `"status":"ok"`

## Google Registration And Inbox Connection

1. Open `${APP_URL}/register`.
2. Choose `Continue with Google`.
3. Complete Google OAuth consent.
4. Confirm registration lands in the app.
5. Open Account Settings.

Expected:

- User account email matches the Google account.
- One primary inbox exists.
- Provider is Google/Gmail.
- Status is `active`.
- Provider watch is `active`.
- Watch expiration is populated.
- Last sync is either populated after initial backfill or remains empty until the
  first processed sync event.
- No separate profile-page consent checkbox is required.

Database spot checks:

- `user_inbox_connections.status = active`
- `user_inbox_connections.is_primary = true`
- `access_token` and `refresh_token` are encrypted strings, not raw OAuth tokens.
- `email_authorization_consents` contains a consent row for the user/provider.

## Microsoft Registration And Inbox Connection

1. Open `${APP_URL}/register` in a fresh browser session.
2. Choose `Continue with Microsoft`.
3. Complete Microsoft OAuth consent using a personal account.
4. Repeat with a work/school account when tenant policy allows it.
5. Open Account Settings.

Expected:

- User account email matches the Microsoft account.
- One primary inbox exists.
- Provider is Microsoft.
- Status is `active`.
- Provider watch is `active`.
- Subscription id is stored.
- Subscription expiration is populated.
- Microsoft Graph validation token handshake succeeds during subscription
  creation.

If a work/school account is blocked by tenant policy, expected behavior is a
clean registration failure and no active session.

## Approved Send Tests

Run this once for Gmail and once for Microsoft.

1. Create or open a project with at least one vendor that has an email address.
2. Create/generate an outreach draft.
3. Click the send approval button.
4. Open the vendor conversation/thread in Envoy.
5. Check the recipient mailbox.

Expected:

- Send is blocked if no active primary inbox exists.
- Approved send goes through the connected user mailbox, not the Envoy system
  mailbox.
- The local draft moves to sent state.
- An outbound `messages` row is created.
- Gmail sends store provider message/thread ids when returned.
- Microsoft sends succeed even if Graph returns no message id.
- The recipient receives the email from the connected user address.

Failure test:

1. Temporarily break the connected inbox authorization or email-service URL.
2. Try to send an approved draft.

Expected:

- Draft remains editable.
- Draft status is `error`.
- No fallback send through the Envoy system mailbox occurs.
- Logs include ids/counts but not message body or access tokens.

## Vendor Reply Sync Tests

Run this once for Gmail and once for Microsoft.

1. Send an approved outreach email to a real test vendor mailbox.
2. From the vendor mailbox, reply to the email.
3. Wait for provider push and the scheduled sync worker.
4. Open the project outreach thread.

Expected:

- Provider webhook receives the notification.
- Email service publishes one SQS sync event.
- `email:sync-events` processes the event.
- The vendor reply appears as an inbound message in the vendor conversation.
- Non-vendor mailbox messages are ignored.
- At most one active local reply draft is created for the inbound vendor reply.
- Connection `last_sync_at` is updated.
- Connection `last_sync_error` remains empty.

Useful commands:

```bash
node ace email:sync-diagnostics
node ace email:sync-events
```

The project-management ECS service normally runs the email sync queue worker
every 10 minutes in dev/prod. Running the command manually is useful for
debugging.

## Manual Backfill Test

1. Connect a Gmail or Microsoft inbox.
2. Ensure the user has a project with vendors whose email addresses already
   appear in the mailbox history.
3. Trigger watch setup through registration/reconnect, or manually enqueue a
   backfill event if needed.
4. Run:

```bash
node ace email:sync-events
```

Expected:

- Vendor-related historical mail is persisted.
- Sent and received vendor mail is associated with vendor conversations when
  possible.
- Non-vendor mail is not persisted.
- Duplicate runs do not create duplicate messages.

## Reconnect, Replace, And Disconnect Tests

### Reauth Required

1. Simulate an auth failure by revoking the app in Google/Microsoft account
   settings or invalidating the stored refresh token in a dev database.
2. Run:

```bash
node ace email:watches:renew
```

Expected:

- Connection is marked `reauth_required`.
- Account page shows the reconnect state.
- App routes requiring an active inbox redirect/gate the user.
- Reconnect starts provider OAuth again.
- Successful reconnect restores the connection to `active`.
- Watch/subscription is configured again.

### Replace Provider

1. Register or connect with Gmail.
2. Go to Account Settings.
3. Choose `Replace with Microsoft`.
4. Complete Microsoft OAuth.

Expected:

- Old Gmail connection is marked `disconnected`.
- Gmail watch stop is attempted.
- New Microsoft connection is primary and active.
- User has only one active primary inbox.

Repeat in the opposite direction, Microsoft to Gmail.

### Disconnect

1. Open Account Settings.
2. Disconnect the active inbox.

Expected:

- Provider watch/subscription stop is attempted.
- Connection is removed or marked disconnected according to the current flow.
- User is blocked from normal app usage until a new active inbox is connected.
- Existing vendor conversation history remains visible after reconnect.

## Microsoft Webhook Validation Test

Call the deployed Graph webhook URL with a validation token:

```bash
curl -i "https://<email-service-domain>/webhooks/microsoft/graph?validationToken=test-token"
```

Expected:

- HTTP `200`
- `Content-Type: text/plain`
- Response body is exactly `test-token`

Repeat for:

```bash
curl -i "https://<email-service-domain>/webhooks/microsoft/lifecycle?validationToken=test-token"
```

## Logging And Data Safety Checks

Inspect project-management and email-service logs during the tests.

Expected:

- Logs identify webhook receipt, queue enqueue, sync processing, send failures,
  and watch renewal.
- Logs include ids, provider, event type, counts, and status.
- Logs do not include access tokens, refresh tokens, email body content, or raw
  provider webhook payloads.

## Acceptance Checklist

Google:

- Registration through combined OAuth works.
- Mail scopes are granted.
- Watch setup succeeds.
- Approved send succeeds.
- Vendor reply syncs through push/SQS.
- Reauth and reconnect work.

Microsoft:

- Registration through combined OAuth works for personal accounts.
- Registration works for work/school accounts when tenant consent policy allows.
- Graph validation token handshake succeeds.
- Subscription setup succeeds.
- Approved send succeeds.
- Vendor reply syncs through Graph/SQS.
- Reauth and reconnect work.

Cross-provider:

- Exactly one active primary inbox exists per user.
- Replace flow disconnects prior provider.
- Disconnect blocks app usage until reconnect.
- Non-vendor messages are ignored.
- Duplicate provider notifications are idempotent.
- Operators can inspect queue/DLQ counts without reading mail contents.
