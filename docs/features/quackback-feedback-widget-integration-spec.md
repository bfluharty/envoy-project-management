# Quackback Self-Hosted Feedback Widget Integration

**Status:** Phases 0–5 complete; Phase 6 not started
**Date:** July 23, 2026  
**Application:** Envoy Project Management  
**Related repository:** `envoy-infrastructure`  
**Owners:** Product and Engineering

## 1. Summary

Envoy will add a Quackback feedback widget to the authenticated application. The
widget will appear as a floating button in the bottom-right corner after an
existing user signs in or a new user completes registration and required Envoy
consent. Opening it will let the user browse, search, vote on, comment on, and
submit feedback without leaving Envoy or completing another sign-in flow.

Quackback will run as an unmodified, independently deployed, self-hosted
AGPL-3.0 service at `https://feedback.hello-envoy.com`. Envoy will identify users
with short-lived, server-signed widget tokens. The widget secret will remain on
the server and will never be exposed through Inertia props or browser code.

The initial production deployment will use Quackback's official production
Docker Compose stack on one 2 GB Amazon Lightsail instance. The target operating
cost is $13–$16 per month, with $16 per month as the approved planning ceiling.
Development will use a local Compose deployment rather than a second always-on
cloud environment.

## 2. Approved Product and Technical Decisions

The following decisions are final for the initial implementation:

1. Quackback will be self-hosted.
2. Production will start on one 2 GB Lightsail instance with an attached static
   IPv4 address.
3. Expected production infrastructure cost is $13–$16 per month before tax.
4. An increase beyond the $16 monthly planning ceiling requires an explicit
   review. The expected next tier is a 4 GB Lightsail instance at approximately
   $25–$29 per month including backups.
5. Quackback will use `feedback.hello-envoy.com`.
6. Only authenticated Envoy users who have completed required Envoy consent may
   load or use the widget.
7. The widget will use Quackback's verified-identity mode. Anonymous interaction
   will be disabled.
8. Envoy authentication is authoritative. Users will not create or enter a
   separate Quackback password to use the widget.
9. The standalone feedback portal will be private. Verified widget sign-in will
   carry an Envoy user into the portal without another login.
10. The launcher will be Quackback's floating bottom-right button.
11. The initial boards will be `Feature Requests` and `Bug Reports`.
12. Users may browse, search, vote, comment, and submit feedback.
13. The roadmap and changelog will be available. Help-center and live-chat
    functionality will be disabled initially.
14. Image attachments will be enabled so bug reports can include screenshots.
15. Quackback email delivery and email notifications are out of scope for the
    initial release.
16. Slack integration is a possible follow-up, not part of this implementation.
17. Quackback AI features and outbound telemetry will be disabled.
18. Production will run a pinned, tested Quackback release, never an unbounded
    `latest` tag.
19. Envoy will consume the SDK served by the Quackback instance instead of
    copying Quackback source or adding the AGPL SDK as a bundled application
    dependency.
20. Envoy will not modify or fork Quackback for this release.

## 3. Goals

- Give authenticated users a low-friction feedback surface inside Envoy.
- Preserve a single sign-in experience by deriving Quackback identity from the
  active Envoy session.
- Attribute posts, votes, and comments to the correct stable Envoy user.
- Let users find and vote on existing feedback before creating duplicates.
- Give the product team an initial feature-request, bug-report, roadmap, and
  changelog workflow.
- Keep Quackback unavailable to anonymous or consent-incomplete visitors.
- Keep Quackback failures isolated so they cannot prevent Envoy pages from
  loading or being used.
- Keep recurring infrastructure cost within the approved ceiling.
- Retain ownership of feedback data and provide backup, recovery, export, and
  deletion procedures.

## 4. Non-Goals

- Building a custom feedback database or feedback-management UI in Envoy.
- Replacing Envoy authentication with Quackback authentication.
- Synchronizing Envoy session cookies into Quackback.
- Allowing public or anonymous feedback.
- Enabling Quackback email OTP, magic-link, or user notification flows.
- Enabling AI summaries, semantic search, automatic tagging, or other Quackback
  AI features.
- Enabling Quackback help center or live chat.
- Integrating Slack, GitHub Issues, Jira, Linear, or another issue tracker.
- Providing high availability or automatic multi-host failover in the first
  release.
- Running an always-on cloud staging instance.
- Modifying Quackback source code or maintaining an Envoy fork.
- Importing historical feedback from another platform.
- Automatically deleting Quackback data when an Envoy account is deleted. A
  documented manual process is required initially; automation can follow.

## 5. Documentation Review and Fit Assessment

### 5.1 Widget behavior

Quackback's browser SDK loads a sandboxed iframe from the Quackback instance. On
desktop the documented panel is approximately 400 by 600 pixels. Below a
640-pixel viewport it becomes a full-screen mobile overlay.

The SDK supports:

- Initialization and destruction.
- Verified and unverified identity.
- Programmatic open and close.
- A built-in floating launcher.
- Board selection and new-post deep links.
- Session metadata.
- Events for readiness, open, close, identify, post creation, votes, and
  comments.

Envoy will use the built-in launcher and verified identity. It will listen for
the `identify` event so a rejected identity token can remove the launcher rather
than leaving the user at a second sign-in prompt.

### 5.2 Verified identity

Quackback's production recommendation is a short-lived HS256 JWT signed on the
host application's server. Relevant claims are:

- `sub`: stable Envoy user UUID.
- `email`: current Envoy account email.
- `name`: current Envoy display name when available.
- `iat`: issued-at Unix timestamp.
- `exp`: expiration Unix timestamp, five minutes after issuance.

The Quackback widget secret must never enter browser code. Repeated
identification with the same stable `sub` should resolve the same Quackback
portal user, including after an Envoy email-address change.

Quackback internally creates its own seven-day portal/widget session after it
accepts the identity token. This is a Quackback session, not a copy of the Envoy
session. Envoy must explicitly clear and destroy widget state during logout and
account changes so one browser user cannot inherit another user's feedback
identity.

### 5.3 Self-hosting requirements

The reviewed Quackback production stack includes:

- The Quackback Bun application.
- PostgreSQL 18 with `pgvector` and `pg_cron`.
- Dragonfly as the Redis-compatible BullMQ store.
- MinIO for private S3-compatible image storage.
- Automatic database migrations at application startup.
- An application health endpoint at `/api/health`.

Quackback documents 1 GB RAM as the minimum and 2 GB or more as recommended.
The official production Compose file exposes only the application port; its
datastores stay on the private Compose network.

Envoy's existing RDS instances run PostgreSQL 16. They must not be reused for
Quackback because Quackback currently requires PostgreSQL 18. Avoiding a major
upgrade to Envoy's primary database is one reason for the separate Lightsail
deployment.

### 5.4 Data and privacy

Quackback stores user name, email, external identity, feedback content, votes,
comments, sessions, metadata, and uploaded images. The reviewed defaults include
seven-day inactive session expiration, 30-day cleanup of soft-deleted posts, and
indefinite retention of active posts and audit logs.

Quackback supports administrative user deletion. The user record is deleted,
votes are removed, and posts/comments are retained with anonymized attribution.
Board data can be exported to CSV.

AI features can send feedback content to a configured OpenAI-compatible
endpoint. Envoy will leave `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and every
`AI_*_MODEL` variable unset. Release `v0.13.1` has no `DISABLE_AI` environment
variable; the absence of an AI provider is the supported disabled state.
Quackback's minimal anonymous telemetry will be disabled with
`DISABLE_TELEMETRY=true`.

### 5.5 License and upgrade posture

Quackback is licensed under AGPL-3.0. The upstream project describes unmodified
self-hosting as free and fully functional. Envoy will:

- Run the official image as an independent network service.
- Load the widget SDK from that service at runtime.
- Preserve upstream notices and links.
- Avoid copying or modifying Quackback source.
- Record the exact deployed version and image digest.
- Require legal and engineering review before any future source modification,
  fork, or bundling of Quackback code into Envoy.

This specification records an engineering posture and is not a substitute for
legal advice.

### 5.6 Documentation/version caveats

The documentation has some historical naming inconsistencies, including privacy
guidance that refers to separate encryption/session variables while the current
production example uses `SECRET_KEY`. Deployment must follow the environment
example and startup validation from the exact release being installed.

Phase 0 completed these checks against `v0.13.1`. The result and exact pins are
recorded below. Every later upgrade must repeat the same gate.

### 5.7 Phase 0 verification record

**Gate result:** Pass with the deployment constraints in this section.  
**Completed:** July 23, 2026  
**Target platform:** Linux `amd64`

#### Release and source selection

The approved release is Quackback `v0.13.1`, published June 29, 2026:

| Item                                   | Approved value                                                            |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Release                                | `v0.13.1`                                                                 |
| Source commit                          | `003c850fac71b4cbbbe7f40e25cc5d439aa7a591`                                |
| Release state                          | Stable; not a draft or prerelease                                         |
| Application image tag                  | `ghcr.io/quackbackio/quackback:0.13.1`                                    |
| Multi-platform image digest            | `sha256:f3a166771f6d78f6a50e7bc9372740e3a0896e129437689870172ca5465b9f42` |
| Linux `amd64` manifest digest          | `sha256:5e8424848e5ea3e4a69995d5e626d16dc4de5636374a140d745ad29f3989072b` |
| Production Compose SHA-256 (canonical LF)             | `c2c73297edc49eaa6a749f0ea0a1d3cd4b0f4de95160ad6671b635148989fd61`        |
| Production environment example SHA-256 (canonical LF) | `66d7792995c6c0e210a4f6e1045aed48ff8033a91858d166ef3398b61b5f5816`        |
| License file SHA-256                   | `36feaed6e6d42e6f84db2eaadbea503caf2cd81ce43a5b4b69594f290ded91cb`        |

The release commit is signed by GitHub's release key. Local Git could inspect
the signature but could not independently establish trust because that public
key was not present in the local keyring. The tag, commit, release metadata,
release workflow, and registry digest otherwise agree. The container reports
application version `0.13.1` and build time `2026-06-29T22:51:29.525Z` at
startup. It does not expose the Quackback commit as an OCI label, so the
immutable image digest is the deployment's authoritative artifact identity.

The canonical source hashes above are for the LF bytes checked out on the
production Linux host. The Phase 0 Windows checkout used Git's CRLF worktree
conversion and produced `69a9aa36386b5da5040e806e02d5b4e3e6c67a87c23cf00374da5283a89d22d7`
for the Compose file and
`3a0c45f09c04b11db7236a96f7fa35e9026ac2db6dbd6da8b70b553a2359c7ea`
for the environment example. Phase 1 reproduced both pairs and corrected the
deployment gate to verify the canonical Linux bytes.

The only published Quackback repository security advisory at gate time is
`GHSA-37j5-56x4-3mxh`, a medium-severity authenticated blind SSRF affecting
versions earlier than `v0.11.0`; `v0.13.1` contains the fix.

#### Supporting image lock

The official Compose template pins Dragonfly but leaves MinIO and its client at
`latest`, and its PostgreSQL Dockerfile starts from the moving `postgres:18`
tag. Production must use a Compose override for published images and must not
resolve those moving tags during deployment.

| Service         | Version/tag reviewed                | Multi-platform digest                                                     | Linux `amd64` manifest                                                    |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Dragonfly       | `v1.27.1`                           | `sha256:e1bdd6ff1ed32efdfb5a07ddf954689a3d69791ae905a1f2197d8aa381ef8e7c` | `sha256:4a4803ab8ef2cd62d2e38ee3fd7500e5393373e6f2f77808b7566642f514efbf` |
| MinIO           | `RELEASE.2025-09-07T16-13-09Z`      | `sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e` | `sha256:a1a8bd4ac40ad7881a245bab97323e18f971e4d4cba2c2007ec1bedd21cbaba2` |
| MinIO client    | `RELEASE.2025-08-13T08-35-41Z`      | `sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727` | `sha256:eb4ea9884b77704230e2423e9004d2fa738dc272876b9cc41a297d29443b8780` |
| PostgreSQL base | `18.4` as resolved by `postgres:18` | `sha256:3a82e1f56c8f0f5616a11103ac3d47e632c3938698946a7ad26da0df1334744a` | `sha256:d93de42662696f278fb34354b06fdaa90ad7ca3106d6f72fbd01d16da006d2cf` |

The reviewed PostgreSQL build installed `postgresql-18-cron` `1.6.7` and
`postgresql-18-pgvector` `0.8.5`. Because the official image is built locally
from package repositories, Phase 1 must capture the resulting image ID in the
deployment record and rebuild it only during an intentional upgrade. A later
rebuild is not assumed to be byte-for-byte reproducible.

The production override must replace the full `image:` value with
`repository@sha256:<multi-platform-digest>`. `QUACKBACK_TAG` remains `0.13.1`
for human-readable configuration because the official Compose expression adds
a colon before that value and therefore cannot accept a digest directly.

#### Production Compose compatibility

The exact tagged source passed `docker compose config --quiet` with Docker
Engine `29.1.3` and Docker Compose `2.40.3`. The official production stack then
ran locally on Linux `amd64` with:

- The Quackback app, PostgreSQL 18, Dragonfly, MinIO, and bucket initializer.
- Automatic migrations completing successfully.
- All long-running services healthy.
- `GET /api/health` returning HTTP `200` and `{"status":"ok"}`.
- Only the application port published to the host.
- PostgreSQL, Dragonfly, and MinIO reachable only on the Compose network.
- The private MinIO bucket served through Quackback's `/api/storage` proxy.
- A seeded workload of 500 posts, 7,796 votes, 988 comments, six changelog
  entries, and three roadmaps.

The four long-running containers used approximately 460 MiB at idle after that
seeded workload: about 207 MiB for Quackback, 56 MiB for PostgreSQL, 114 MiB for
Dragonfly, and 83 MiB for MinIO. This is not a load test, but it supports the
2 GB starting size. Phase 6 still owns concurrency, sustained-load, and memory
alarm validation.

#### Widget and access-control validation

The reviewed release supports the approved widget design with one navigation
constraint:

| Capability                           | Phase 0 result                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Floating bottom-right launcher       | Supported by `position: "bottom-right"`                                                          |
| Verified Envoy identity              | Supported with HS256 JWT, stable `sub`, `email`, optional `name`, and five-minute default expiry |
| Reject unverified identity           | Live validation returned HTTP `403` with `TOKEN_REQUIRED`                                        |
| Reject invalid or expired identity   | Live validation returned HTTP `403` with `TOKEN_INVALID`                                         |
| Accept valid signed identity         | Live validation returned HTTP `200` and a Quackback Bearer session for the same user             |
| Restore authenticated widget session | Live `/api/widget/session` validation returned the identified Envoy email                        |
| Private portal handoff               | Supported by widget-origin session provenance, one-time-token handoff, and `widgetSignIn`        |
| Browse and search protected boards   | Supported; live authenticated search returned only the requested protected board                 |
| Vote, comment, and submit            | Supported by the feedback widget and per-board authenticated permission model                    |
| Screenshot/image upload              | Supported through authenticated `/api/widget/upload` and private S3/MinIO storage                |
| Changelog in widget                  | Supported as a native widget tab                                                                 |
| Roadmap in widget                    | Not a native widget tab in `v0.13.1`                                                             |
| Roadmap in private portal            | Supported at `/roadmap` after verified widget handoff                                            |
| Help center and live chat disabled   | Supported by widget tab and feature flags                                                        |
| AI disabled                          | Supported by leaving the OpenAI and AI model variables unset                                     |
| Telemetry disabled                   | Supported by `DISABLE_TELEMETRY=true`                                                            |

The native widget tab model in `v0.13.1` is Home, Feedback, Changelog, and a
combined Help/Chat surface. The implementation must expose roadmap through the
private portal handoff rather than promising a roadmap tab inside the floating
panel.

Five focused upstream widget suites passed against the tagged source: widget
navigation, identify precedence, private-portal URL construction, JWT
verification, and uploads. The result was 55 passing tests. Live artifact tests
also confirmed the health endpoint, widget configuration and SDK endpoints,
private portal gate, valid/invalid/expired identity behavior, Bearer-session
resolution, and authenticated board search. Purely visual and responsive
browser checks remain in Phase 6.

#### License decision

The gate confirms the engineering posture in Section 5.5:

- Quackback `v0.13.1` is AGPL-3.0.
- The reviewed MinIO server and client binaries also report AGPLv3.
- Dragonfly `v1.27.1` uses Business Source License 1.1 with a March 1,
  2029 change date to Apache-2.0. Its Additional Use Grant permits use as part
  of Envoy because Envoy is not an in-memory datastore product or a competing
  managed datastore service.
- Envoy will operate these as unmodified, separately deployed services and
  will retain their license and source notices.
- Envoy will load Quackback's SDK from the self-hosted service at runtime; it
  will not copy the SDK source or bundle the package into Envoy.
- Any Quackback or MinIO source modification, fork, redistribution, or move to
  a bundled dependency requires a fresh legal and engineering review.

This is an accepted engineering gate, not legal advice.

## 6. Existing Envoy Context

`envoy-project-management` currently uses:

- AdonisJS 6.
- Inertia.
- Svelte 5.
- Server-side rendering.
- A shared authenticated-user Inertia prop containing `uuid`, `email`,
  `fullName`, and avatar information.
- A persistent authenticated sidebar on the main consumer pages.
- An authenticated navbar on some role-specific pages.
- A required consent gate before protected product data is exposed.
- Secure environment values supplied from SSM Parameter Store in deployed ECS
  tasks.

`envoy-infrastructure` currently uses:

- AWS CDK.
- ECS Fargate for Envoy services.
- CloudFront, WAF, and an ALB for the main application.
- PostgreSQL 16 RDS instances.
- Separate dev and production stacks in `us-east-1`.

The feedback host is a separate service boundary. It does not join the Envoy VPC
and does not receive access to Envoy's database, internal ALBs, or application
secrets.

## 7. User Experience

### 7.1 Returning user sign-in

1. The user signs in to Envoy.
2. Envoy completes its normal authentication, inbox, role, and consent checks.
3. The first eligible application page mounts the feedback integration.
4. The browser requests a short-lived widget token from Envoy.
5. Envoy signs the current user's identity and returns the token.
6. The browser initializes Quackback with the token.
7. A floating feedback button appears in the bottom-right corner.
8. Opening the widget shows the user as already signed in.

No Quackback login, email prompt, password prompt, or account-creation screen may
appear in the expected flow.

### 7.2 New account registration

1. The user completes Envoy's existing provider registration.
2. The user completes required Envoy consent and any required project or
   role-specific registration steps.
3. On the first eligible authenticated application page, the widget follows the
   same initialization flow as a returning user.

The widget must not appear on the OAuth callback, login, registration, password
recovery, or required consent page.

### 7.3 Opening the widget

- Desktop: a bottom-right launcher opens the anchored Quackback panel.
- Mobile: the launcher opens Quackback's full-screen mobile overlay.
- The launcher must not cover Envoy's primary mobile actions, consent controls,
  toast region, or other fixed controls.
- Quackback's built-in accessible name and keyboard behavior must remain intact.
- Reduced-motion behavior must follow the SDK and browser preference.

### 7.4 Feedback workflow

The initial widget home lets users:

- Browse posts across both boards.
- Search before submitting.
- Vote or remove a vote.
- Open a post and read its status and comments.
- Add comments.
- Submit a feature request.
- Submit a bug report with an optional screenshot.
- Read the changelog.
- Follow a verified handoff to the private full portal and roadmap.

Quackback `v0.13.1` does not have a native roadmap widget tab. Roadmap
navigation must use the verified handoff to the private portal. It remains part
of the approved user experience, but the launcher panel itself will expose only
Home, Feedback, and Changelog.

### 7.5 Logout and account switching

Before or during Envoy logout:

1. Call the SDK logout command if the SDK is ready.
2. Destroy all Quackback widget DOM and in-memory state.
3. Remove any Envoy-owned cached widget token.
4. Continue the normal Envoy logout request.

If another user signs in in the same browser, Envoy must request a new token and
identify the new user. No name, email, votes, or draft state from the previous
user may be displayed.

## 8. Architecture

```text
Envoy browser
  |
  | 1. POST /api/feedback/widget-token
  |    Envoy session cookie + same-origin request
  v
envoy-project-management
  |
  | 2. Verify auth + required consent
  | 3. Sign five-minute HS256 token with widget secret
  v
Envoy browser
  |
  | 4. Load /api/widget/sdk.js from feedback.hello-envoy.com
  | 5. Initialize SDK with { ssoToken }
  v
Quackback iframe
  |
  | 6. Verify signature and resolve/create portal user
  | 7. Store posts, votes, comments, metadata, and images
  v
Quackback PostgreSQL / Dragonfly / MinIO
```

Trust boundaries:

- The Envoy browser receives a short-lived identity assertion but never the
  signing secret.
- Quackback receives only the identity and metadata explicitly defined here.
- Quackback has no network or credential access to Envoy's databases.
- Envoy does not query Quackback's database.
- The Quackback admin surface is separate from Envoy product authorization.

## 9. Envoy Backend Changes

### 9.1 Environment variables

Add these variables to `start/env.ts` and `.env.example`:

```text
QUACKBACK_ENABLED=false
QUACKBACK_BASE_URL=
QUACKBACK_WIDGET_SECRET=
```

Rules:

- `QUACKBACK_ENABLED` defaults to `false`.
- `QUACKBACK_BASE_URL` is the exact origin with no trailing slash.
- Production value: `https://feedback.hello-envoy.com`.
- `QUACKBACK_WIDGET_SECRET` is server-only.
- When the feature is enabled, startup validation must reject a missing or
  invalid base URL and a widget secret shorter than 32 characters.
- Tests may leave the integration disabled unless explicitly exercising it.
- Never include `QUACKBACK_WIDGET_SECRET` in Inertia data, API errors, logs,
  health output, browser bundles, or exception context.

Deployed Envoy tasks will read the widget secret from:

```text
/envoy/dev/QUACKBACK_WIDGET_SECRET
/envoy/prod/QUACKBACK_WIDGET_SECRET
```

The base URL and enabled flag may be ordinary ECS task environment values.

### 9.2 Shared client configuration

Add a nullable shared Inertia prop:

```ts
interface FeedbackWidgetConfig {
  enabled: true
  baseUrl: string
}
```

Return the prop only when:

- The feature flag is enabled.
- `ctx.auth.user` exists.
- The user is active.
- The user has satisfied all current required consent.
- The current route is allowed to display the widget.

Otherwise return `null`. Do not expose user identity through this prop because
the widget token endpoint is the source of trusted identity.

### 9.3 Token endpoint

Add:

```text
POST /api/feedback/widget-token
```

Middleware:

- Authenticated session.
- Required consent.
- Same-origin verification.

The controller delegates token construction to a focused service. It must use
the authenticated server-side user model rather than accepting identity fields
from the request body.

Successful response:

```json
{
  "ssoToken": "<short-lived-jwt>"
}
```

Required response headers:

```text
Cache-Control: no-store, private
Pragma: no-cache
```

JWT header:

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

JWT payload:

```json
{
  "sub": "<envoy-user-uuid>",
  "email": "<current-email>",
  "name": "<current-display-name>",
  "iat": 1784760000,
  "exp": 1784760300
}
```

Requirements:

- Sign with HMAC-SHA256 and `QUACKBACK_WIDGET_SECRET`.
- Expire five minutes after issue.
- Use the stable Envoy UUID, never the integer database primary key.
- Normalize the email consistently with Envoy's existing authentication rules.
- Omit `name` rather than sending an empty value.
- Do not include provider IDs, inbox tokens, entitlements, consent choices,
  project content, or mailbox data.
- Do not accept a user UUID or email in the request body.
- Do not log the token or response body.
- Return `401` for no authenticated session.
- Return `403` for incomplete consent or an ineligible account.
- Return `404` or a controlled disabled response when the feature is disabled.
- Return `503` for invalid server configuration without leaking configuration
  details.

The implementation may use Node's built-in `crypto` primitives. A JWT dependency
is unnecessary unless the team prefers a vetted dependency with an already
approved maintenance posture.

### 9.4 Token issuance rate and abuse controls

Token issuance is low cost and authenticated, but the endpoint must still:

- Reject cross-origin requests.
- Use the existing application-level rate-limiting pattern if available.
- Allow normal page transitions without presenting false-positive errors.
- Avoid database writes.
- Avoid caching tokens across users.

A starting limit of 30 successful token requests per authenticated user per five
minutes is sufficient. Rate-limit failure must hide the widget without affecting
the rest of Envoy.

## 10. Envoy Frontend Changes

### 10.1 Integration module

Create a small browser-only Quackback integration module responsible for:

- Defining the SDK command queue before the remote script loads.
- Guaranteeing only one SDK script element and one widget instance exist.
- Loading `${baseUrl}/api/widget/sdk.js` asynchronously.
- Initializing with the verified identity token.
- Updating safe session metadata on Inertia navigation.
- Subscribing and unsubscribing from SDK events.
- Logging out and destroying the SDK.
- Handling a failed or blocked script without throwing into Envoy rendering.

Do not add `@quackback/widget` to `package.json` for the initial integration.

### 10.2 Feedback component

Create a reusable Svelte component with no server-rendered visual output. On
mount it:

1. Confirms the shared eligible configuration exists.
2. Requests a token from `/api/feedback/widget-token`.
3. Creates the Quackback command queue.
4. Queues explicit initialization with the identity token before appending the
   remote SDK script. This prevents the SDK's anonymous auto-initialization from
   winning the race.
5. Initializes the built-in launcher with right placement.
6. Subscribes to `identify`.
7. Removes the widget if verified identification fails.

The effective initialization is:

```js
Quackback('init', {
  placement: 'right',
  identity: { ssoToken },
})
```

Board visibility, tabs, colors, and image uploads should be controlled from the
Quackback admin configuration rather than duplicated in client code unless a
tested release requires an explicit SDK option.

### 10.3 Placement in Envoy layouts

The component must be included once on each eligible authenticated application
shell. Current coverage must include:

- Consumer pages that use `sidebar.svelte`.
- Authenticated role-specific pages that use `navbar.svelte`.
- Future authenticated layouts through a documented integration point.

It must not mount on:

- Landing page for a signed-out visitor.
- Login or registration.
- Password reset or account recovery.
- OAuth callback pages.
- Required consent.
- Error pages rendered without an eligible authenticated context.

The frontend integration must guard against double initialization if a future
page renders more than one eligible shell.

### 10.4 Metadata

Attach only operational context that helps reproduce feedback:

```ts
{
  envoy_environment: 'dev' | 'prod',
  page_area: 'dashboard' | 'project' | 'contacts' | 'inbox' | 'account' | 'other',
  app_version: '<git-sha-or-unknown>'
}
```

Optional project context may include a project UUID if Product determines it is
useful. Do not send:

- Full URLs or query strings.
- Search terms.
- Form contents.
- Conversation or email content.
- Vendor names.
- OAuth/provider data.
- Tokens or secrets.
- Consent choices.

Update `page_area` when Inertia navigation changes the active section.

### 10.5 Events

For the initial release:

- `ready`: may mark local initialization success.
- `identify`: must detect failure and destroy the widget.
- `post:created`: may trigger an Envoy success toast if it does not duplicate
  Quackback's confirmation.
- `vote` and `comment:created`: no Envoy action is required.

Event payloads must not be written to server logs by default. In particular, do
not log post titles or user email addresses as observability events.

### 10.6 Failure isolation

- Token failure: do not load or show the widget.
- Script failure: remove any incomplete launcher and continue normally.
- Quackback health failure: Envoy remains fully usable.
- Identify failure: destroy the widget so the user does not see a second login.
- Slow Quackback response: never block Inertia hydration or page interaction.
- Content blocker/CSP rejection: fail silently apart from a development-safe
  diagnostic.

## 11. Quackback Workspace Configuration

### 11.1 Workspace

- Name: `Envoy`.
- Header display name: `Envoy Feedback`.
- Use case: `saas`.
- Portal visibility: private.
- Open signup: off after the initial administrator is created.
- Widget: enabled.
- Verified identity only: enabled.
- Widget sign-in to private portal: enabled.
- Anonymous interaction: disabled.
- Help center: disabled.
- Live chat: disabled.
- AI: disabled.
- Telemetry: disabled.
- Email and magic-link sign-in: disabled.

At least one secure team-admin authentication method must remain available.
Because email delivery is initially disabled, the team must retain a tested
administrator-access and credential-recovery runbook.

Quackback `v0.13.1` does not enforce `openSignup` at its password-registration
HTTP endpoint, even when the stored setting is false. Production therefore
also rejects `POST /api/auth/sign-up/email` and its trailing-slash form at
Caddy. Password sign-in remains proxied for the administrator account. Remove
this compensating control only after a reviewed Quackback release enforces
closed signup server-side.

### 11.2 Widget presentation

- Placement: bottom right.
- Feedback tab: enabled.
- Changelog tab: enabled.
- Help tab: disabled.
- Chat tab: disabled.
- Image uploads in widget: enabled.
- Primary colors: match the Envoy brand and pass WCAG contrast requirements in
  both light and dark modes.
- Locale: browser-detected English for the initial release.

### 11.3 Boards

Create:

#### Feature Requests

- Slug: `feature-requests`.
- View: signed-in users.
- Vote: signed-in users.
- Comment: signed-in users.
- Submit: signed-in users.
- Signed-in posts: publish without approval initially.
- Images: allowed.

#### Bug Reports

- Slug: `bug-reports`.
- View: signed-in users.
- Vote: signed-in users.
- Comment: signed-in users.
- Submit: signed-in users.
- Signed-in posts: require approval initially because screenshots and bug
  descriptions may contain account or project information.
- Images: allowed.

The Bug Reports description must warn users not to include passwords, access
tokens, payment data, connected-email contents, or other sensitive information.

### 11.4 Statuses, roadmap, and changelog

Start with Quackback's default status flow:

```text
Open -> Under Review -> Planned -> In Progress -> Complete
                                  \-> Closed
```

Roadmap columns:

- Planned.
- In Progress.
- Complete.

Do not show Open, Under Review, or Closed on the roadmap.

Changelog entries are created and published by the Envoy product team.
Publication will not send email while email delivery remains disabled.

### 11.5 Team access

- Keep the initial admin count minimal.
- Use unique administrator accounts.
- Enable available team 2FA.
- Do not promote Envoy portal users to Quackback team roles.
- Review Quackback audit logs during access or configuration incidents.

## 12. Production Infrastructure

### 12.1 Topology

Create one production Lightsail instance in `us-east-1`:

- Linux.
- 2 vCPU.
- 2 GB RAM.
- 60 GB SSD.
- Public IPv4 bundle.
- Attached static IPv4.
- No Lightsail load balancer.
- No managed Lightsail database.
- No separate Redis service.
- No CDN.

Run the official production stack:

- Quackback app.
- PostgreSQL 18.
- Dragonfly.
- MinIO.

Install Caddy on the host as the TLS-terminating reverse proxy. Caddy proxies
only to `127.0.0.1:3000`.

### 12.2 Network controls

Lightsail firewall:

- Allow TCP 80 from the internet for HTTPS redirection and ACME.
- Allow TCP 443 from the internet.
- Allow TCP 22 only from explicitly approved administrator CIDRs.
- Do not expose ports 3000, 5432, 6379, 9000, or 9001.

Host firewall should enforce the same policy. Datastore containers remain
reachable only on the private Compose network.

### 12.3 DNS and TLS

1. Attach the Lightsail static IP.
2. Add the `feedback.hello-envoy.com` DNS record through the existing DNS
   provider.
3. Configure Caddy for that hostname.
4. Let Caddy issue and renew a Let's Encrypt certificate.
5. Redirect HTTP to HTTPS.
6. Forward `Host`, `X-Real-IP`, `X-Forwarded-For`,
   `X-Forwarded-Proto`, `Upgrade`, and `Connection`.
7. Set Quackback `BASE_URL` to the exact HTTPS origin.

The Quackback iframe route is designed to be embedded broadly. At the reverse
proxy, evaluate replacing its `frame-ancestors` policy with an allowlist for:

- `https://app.hello-envoy.com`
- `https://dev-app.hello-envoy.com` if dev is permitted to use production,
  though this is not recommended.

Do not deploy this header until the real widget and private-portal handoff pass
end-to-end testing. Local development needs a separate localhost policy.

### 12.4 Host and container hardening

- Use automatic security updates for the base OS.
- Run Quackback's non-root application image unchanged.
- Store `/opt/quackback/.env` with owner-only permissions.
- Generate unique high-entropy values for Quackback `SECRET_KEY`, PostgreSQL,
  and MinIO.
- Pin Quackback, Dragonfly, MinIO, and MinIO client images by immutable digest
  in a Compose override; do not rely on their tag values alone.
- Pin the PostgreSQL base digest used by the local extension-image build and
  record the built PostgreSQL image ID.
- Do not put secrets in CDK context, user data, Git, shell history, or Compose
  files.
- Disable password SSH login and direct root SSH.
- Retain only required administrators' SSH keys.
- Configure log rotation and disk-usage alerts.
- Configure a small swap file only if load testing shows it is necessary; swap
  is not a replacement for a memory-tier upgrade.

### 12.5 Infrastructure as code

Add a dedicated production feedback stack or construct to
`envoy-infrastructure` that owns:

- Lightsail instance.
- Static IP and attachment.
- Firewall rules.
- Stable resource names and outputs.
- Instance CPU/status alarms where supported.

Bootstrap user data may install Docker, Compose, Caddy, and baseline host
configuration, but it must not contain application secrets. Quackback workspace
bootstrap and `.env` secret installation remain an explicit secure runbook step.

### 12.6 Quackback runtime environment

The exact file follows the pinned release's `.env.prod.example`. Required
intent includes:

```text
BASE_URL=https://feedback.hello-envoy.com
SECRET_KEY=<generated>
QUACKBACK_TAG=0.13.1
APP_PORT=3000
POSTGRES_USER=quackback
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=quackback
MINIO_ROOT_USER=quackback
MINIO_ROOT_PASSWORD=<generated>
S3_BUCKET=quackback
S3_REGION=us-east-1
MINIO_IMAGE_TAG=RELEASE.2025-09-07T16-13-09Z
MC_IMAGE_TAG=RELEASE.2025-08-13T08-35-41Z
DISABLE_TELEMETRY=true
```

Leave SMTP, Resend, OAuth, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and every
`AI_*_MODEL` variable unset. Do not add `DISABLE_AI`; `v0.13.1` does not read
that variable. The Phase 0 Compose override supplies the immutable image
digests recorded in Section 5.7.

### 12.7 Cost guardrail

Expected monthly cost:

| Component                                          |  Expected cost |
| -------------------------------------------------- | -------------: |
| 2 GB Lightsail instance                            |            $12 |
| Incremental snapshots and retained logical backups |          $1–$3 |
| Static IP while attached                           |             $0 |
| TLS                                                |             $0 |
| Existing DNS zone/record                           | $0 incremental |
| Total                                              |        $13–$16 |

Operational rules:

- Do not add a Lightsail load balancer, managed database, second production
  node, or always-on staging host without cost review.
- Data transfer must remain within the included 3 TB allowance.
- Alert at 75% memory, 70% disk, and sustained CPU pressure.
- If resource pressure persists after investigation, present the 4 GB upgrade
  and revised $25–$29 estimate for approval.

## 13. Local Development

Provide a documented local Quackback workflow based on the pinned upstream
release:

- Quackback origin: `http://localhost:3000`.
- Envoy origin: `http://localhost:8080`.
- A dedicated Quackback PostgreSQL 18 instance; do not point it at Envoy's local
  PostgreSQL 16 container.
- Local Dragonfly and MinIO from Quackback's Compose files.
- A local-only widget secret.
- Seed or manually create the two boards and required workspace settings.

Recommended commands should:

1. Start Quackback independently.
2. Configure Envoy's local Quackback variables.
3. Start Envoy through its existing native or Docker workflow.
4. Explain how to retrieve local console-only admin authentication output if
   needed.
5. Explain how to reset only local Quackback data.

Never add production secrets or production database dumps to local development.

## 14. Backups, Recovery, and Upgrades

### 14.1 Backups

- Enable daily Lightsail automatic snapshots.
- Run a nightly compressed `pg_dump` inside the Compose deployment.
- Retain seven daily logical dumps on the encrypted instance volume.
- Ensure the automatic snapshot captures those dumps.
- Back up MinIO data through the instance snapshot.
- Alert on failed dumps and disk usage.
- Do not treat CSV export as the only backup.

### 14.2 Restore testing

At least quarterly:

1. Create a replacement test instance from a snapshot.
2. Keep it isolated from production DNS.
3. Restore the logical database dump when testing database-level recovery.
4. Confirm posts, votes, comments, users, and uploaded images.
5. Confirm `/api/health`.
6. Destroy the test instance after recording results.

### 14.3 Upgrade

For every Quackback upgrade:

1. Review release notes and AGPL/source changes.
2. Test the target version in local development.
3. Confirm widget identity, private portal handoff, boards, images, and mobile
   behavior.
4. Take a Lightsail snapshot and fresh logical database dump.
5. Pin the new version/digest.
6. Pull images and restart the production Compose stack.
7. Allow automatic migrations to finish once.
8. Run smoke tests.
9. Record the deployed version and time.

Do not allow multiple application replicas to race automatic migrations.

### 14.4 Rollback

If no incompatible migration ran, restore the previous image tag and restart.
If a migration changed the schema incompatibly:

1. Stop Quackback.
2. Restore the pre-upgrade snapshot or logical database backup.
3. Restore the previous pinned image.
4. Validate health and identity.
5. Re-enable DNS/traffic if it was removed.

The single-host design permits a maintenance window during upgrades and restore.

## 15. Security and Privacy Requirements

- Use HTTPS for Envoy and Quackback in production.
- Require verified widget identity.
- Keep the portal private.
- Disable anonymous interactions.
- Keep the widget secret only in Quackback admin storage and Envoy SSM/runtime.
- Use five-minute identity-token expiration.
- Mark token responses `no-store`.
- Verify same-origin token requests.
- Never log identity tokens.
- Never put feedback credentials in client-visible props.
- Do not send connected-mailbox content or provider data to Quackback.
- Do not enable Quackback AI.
- Disable Quackback telemetry.
- Restrict Quackback team administration.
- Keep datastores and port 3000 off the public internet.
- Back up and test recovery.
- Apply security upgrades in a timely manner.

Before launch, update Envoy's Privacy Policy to disclose:

- Collection of feedback, votes, comments, and optional screenshots.
- Storage of the user's Envoy UUID, name, and email in the self-hosted feedback
  system.
- Purpose of processing.
- Retention and anonymization behavior.
- How a user can request access, export, correction, or deletion.
- That feedback may be visible to other authenticated Envoy users.
- That users should not submit sensitive mailbox, credential, payment, or
  personal information in feedback.

Document the manual deletion workflow:

1. Verify the requester's Envoy identity.
2. Locate the Quackback portal user by stable Envoy UUID or email.
3. Export relevant data if requested.
4. Delete the Quackback user through the admin flow.
5. Confirm votes are removed, sessions invalidated, and posts/comments
   anonymized.
6. Record completion in Envoy's privacy-request process.

## 16. Testing Plan

### 16.1 Unit tests

Token service:

- Produces three JWT segments.
- Uses `HS256`.
- Uses Envoy UUID as `sub`.
- Includes current email.
- Includes optional non-empty name.
- Sets `iat`.
- Sets `exp` to five minutes after `iat`.
- Produces a signature Quackback accepts.
- Rejects missing or short secrets.
- Never accepts client-supplied identity.

Frontend integration:

- Creates one command queue.
- Creates one script element.
- Queues explicit initialization before script execution.
- Passes only `{ ssoToken }` as identity.
- Destroys on logout/unmount.
- Ignores duplicate mounts.
- Updates only allowed metadata.
- Removes itself after identify failure.

### 16.2 Functional tests

`POST /api/feedback/widget-token`:

- Returns `401` to a guest.
- Returns `403` to a consent-incomplete user.
- Returns a controlled disabled response when the feature is off.
- Returns `200` and `ssoToken` to an eligible user.
- Returns `no-store` headers.
- Signs server-side user data even if a request body contains different data.
- Does not return the widget secret.
- Applies same-origin protection.
- Applies rate limiting without affecting other routes.

Shared Inertia configuration:

- Is `null` for guests.
- Is `null` during required consent.
- Is `null` when disabled.
- Contains only enabled/base URL for eligible users.

### 16.3 UI tests with a stubbed SDK

Playwright must not depend on a live internet or Quackback service in the normal
suite. Intercept the SDK request with a deterministic test double.

Verify:

- No launcher on signed-out pages.
- No launcher on required consent.
- Launcher appears after eligible sign-in.
- Registration completion reaches a page with the launcher.
- Launcher is bottom-right and does not overlap tested controls.
- Clicking opens the stub panel.
- Token endpoint is called without identity fields in the request.
- Logout destroys the widget.
- A second browser user receives a different identity token.
- SDK load failure leaves Envoy usable.
- Token failure leaves Envoy usable and hides the launcher.
- Desktop and mobile viewport behavior.
- Keyboard access and accessible launcher name.

### 16.4 Real local integration tests

Run before production deployment:

- Verified identity succeeds with the local widget secret.
- Repeated sign-in maps to one Quackback user.
- Email/name updates preserve identity by Envoy UUID.
- Direct unverified identity is rejected.
- Anonymous interaction is rejected.
- Direct anonymous portal access is rejected.
- Widget-to-private-portal handoff requires no second sign-in.
- Feature request submission works.
- Bug report plus screenshot works.
- Search, vote, unvote, comment, and changelog work.
- Roadmap is reachable without another login.
- Logout and account switching do not leak state.
- Quackback unavailability does not break Envoy.

### 16.5 Infrastructure tests

- Only ports 80, 443, and restricted 22 are reachable.
- HTTP redirects to HTTPS.
- TLS certificate is valid and renews.
- Port 3000 is not public.
- PostgreSQL, Dragonfly, and MinIO are not public.
- `/api/health` returns success through the public hostname.
- Restart preserves feedback and images.
- Snapshot restore works.
- Logical database restore works.
- Disk and resource alarms fire in a controlled test.

## 17. Rollout Plan

### Phase 0: Version and license gate

**Status:** Complete on July 23, 2026. Evidence and exact pins are in
Section 5.7.

- [x] Select and pin the Quackback release and image digest.
- [x] Confirm official production Compose compatibility.
- [x] Record license posture.
- [x] Validate the current widget feature set.

### Phase 1: Infrastructure

**Status:** Complete on July 23, 2026. AWS infrastructure, the pinned runtime,
host controls, DNS, TLS, snapshots, logical backups, and public health
validation all passed.

- [x] Add the Lightsail stack/construct.
- [x] Deploy instance, static IP, firewall, and alarms.
- [x] Install Docker and Caddy.
- [x] Configure DNS and validate TLS.
- [x] Install and health-check the pinned official Quackback stack.
- [x] Configure snapshots and validate logical backups.

### Phase 2: Workspace bootstrap

**Status:** Complete on July 23, 2026.

- [x] Create and verify exactly one initial administrator.
- [x] Create both boards and the six default statuses.
- [x] Configure private portal access and signed-in board permissions.
- [x] Enable verified widget identity and store its secret as an AWS SSM
  `SecureString`.
- [x] Enable private-portal widget sign-in.
- [x] Disable anonymous interaction, open registration, social sign-in, magic
  link, help, chat, AI, and telemetry.
- [x] Configure Envoy branding, feedback and changelog tabs, the product
  roadmap, and screenshot-capable object storage.

Production evidence:

- Workspace identity is locked by `/etc/quackback/config.yaml` to `Envoy`,
  slug `envoy`, and use case `saas`. The config directory is mounted read-only
  into the application container.
- Quackback has one administrator, two active boards, six active statuses, and
  one public `Product Roadmap`. Only Planned, In Progress, and Complete are
  roadmap statuses.
- Both boards require an authenticated actor for view, vote, submit, and
  comment. Feature requests publish immediately; signed-in bug reports enter
  moderation. The bug-report description warns against submitting secrets or
  sensitive connected data.
- The portal is private, widget sign-in is on, and anonymous interaction is
  off. Direct unsigned widget identification returns `TOKEN_REQUIRED`.
- A correctly signed, deliberately incomplete probe reached claim validation,
  proving the Quackback and SSM secret copies match without creating a test
  user. Both copies had SHA-256 prefix `6df7df35e6864823` at validation time.
- The production secret is
  `/envoy/prod/QUACKBACK_WIDGET_SECRET`, type `SecureString`, version 1. Its
  value was never printed, committed, or sent through chat.
- The public widget configuration reports HMAC required, bottom-right
  placement, feedback/changelog/home enabled, help/chat disabled, and Envoy
  blue `#0770ef` with white foreground in both themes.
- Caddy returns `403 SIGNUP_DISABLED` for password registration while the
  administrator password-sign-in route remains available.
- PostgreSQL, Dragonfly, MinIO, and Quackback remained healthy after
  configuration. Fresh validated logical backups were taken immediately before
  the workspace transaction and after final validation.

Version note: the current Quackback declarative-configuration documentation
still describes top-level `auth` and `features` management. In the reviewed
`v0.13.1` source, those keys are deprecated compatibility inputs and the
reconciler deliberately ignores them. Only the supported workspace fields are
locked declaratively; runtime auth, portal, board, widget, and feature settings
were configured and verified separately.

### Phase 3: Envoy backend

- Add validated environment variables.
- Add SSM references in dev/prod ECS task definitions.
- Add eligible shared configuration.
- Add token service and endpoint.
- Add unit and functional tests.

**Completed:** July 23, 2026

Implementation notes:

- Envoy validates the enabled configuration at startup and keeps the integration
  disabled by default.
- Eligible Inertia responses expose only the public Quackback origin.
- `POST /api/feedback/widget-token` issues a five-minute HS256 token from the
  authenticated user model behind auth, current-consent, same-origin, active-user,
  and per-user rate-limit checks.
- Development and production ECS task definitions reference separate encrypted
  SSM parameters. Both deployed feature flags remain disabled pending Phase 6.
- Focused unit, functional, infrastructure, type, build, and synthesis checks
  cover the Phase 3 contract.

### Phase 4: Envoy frontend

- Add the SDK integration module and Svelte component.
- Mount it in eligible authenticated shells.
- Add safe metadata and cleanup behavior.
- Add UI tests with the SDK stub.

**Completed:** July 23, 2026

Implementation notes:

- The browser integration requests a short-lived SSO token before creating the
  Quackback command queue or loading the remote SDK. It initializes with only
  the verified token and the bottom-right placement.
- A single non-rendering Svelte component is mounted from both current
  authenticated shell variants. Future authenticated shells must use the same
  component instead of loading the SDK directly.
- Reference-counted lifecycle handling preserves one widget across Inertia
  shell swaps, updates only the approved environment, page-area, and app-version
  metadata, and destroys the runtime on logout, account changes, ineligible
  routes, or final unmount.
- Token, script, and verified-identity failures remain isolated from Envoy. The
  integration does not retry in a loop or fall back to anonymous Quackback
  identity.
- Unit tests cover metadata minimization. Playwright uses a deterministic SDK
  stub to cover eligibility, exact initialization, navigation, account changes,
  cleanup, failure isolation, keyboard activation, bottom-right placement, and
  mobile full-screen behavior.

### Phase 5: Privacy and operations

- Update the Privacy Policy.
- Document admin access, deletion, backup, restore, upgrade, secret rotation, and
  incident procedures.
- Perform a restore drill.

**Completed:** July 23, 2026

Implementation notes:

- The user-facing and repository Privacy Policies now disclose the self-hosted
  feedback system's identity data, submissions, votes, comments, optional
  screenshots, limited page metadata, processing purposes, private-board
  visibility, retention/anonymization, and access/export/correction/deletion
  procedures.
- The material revision is versioned as `2026-07-23-privacy-v2`. Existing
  accepted users must complete the existing privacy-only re-acknowledgment
  before they become eligible for the widget.
- The feedback-host runbook now covers administrator access and credential
  recovery without email, privacy requests and deletion, backup and both
  recovery paths, upgrades and rollback, coordinated secret rotation, incident
  response, and quarterly drills.
- A production recovery drill restored a same-size isolated Lightsail clone
  from a temporary snapshot and independently restored the latest logical dump.
  Health, database invariants, source/dump-time counts, and MinIO state were
  verified. The drill identified and documented the pinned PostgreSQL image's
  requirement that a full logical restore target be named `quackback` because
  of `pg_cron`.
- The disposable instance and drill-only manual snapshot were deleted after AWS
  reported successful cleanup. The production instance, static IP, and public
  health remained intact.

### Phase 6: Development and production validation

- Complete the real local integration test matrix.
- Deploy Envoy changes to dev with a dev/local Quackback target.
- Run smoke, responsive, accessibility, and failure-isolation tests.
- Enable the production feature flag for internal accounts first.
- Verify attribution and moderation.
- Expand to all eligible users.

## 18. Rollback and Kill Switch

The primary kill switch is:

```text
QUACKBACK_ENABLED=false
```

Disabling it must:

- Stop emitting client configuration.
- Prevent token issuance.
- Prevent the widget from mounting on the next navigation/page load.
- Leave all existing Quackback data untouched.

Rollback order:

1. Disable the Envoy feature flag.
2. Confirm the launcher is absent.
3. Roll back Envoy code if necessary.
4. Keep Quackback available to administrators for diagnosis/export.
5. Stop the Quackback host only for a security or data-integrity incident.

## 19. Observability and Operations

Monitor:

- Quackback `/api/health`.
- Host reachability.
- CPU, memory, disk, and restart count.
- PostgreSQL health and backup completion.
- TLS renewal.
- Envoy widget-token `4xx`, `429`, and `5xx` counts.
- Client identify failure rate without recording tokens or PII.
- Quackback version and available security releases.

Operational cadence:

- Daily automated health and backup checks.
- Weekly review of disk and container restarts.
- Monthly upstream release review.
- Quarterly restore drill.
- Quarterly Quackback team-access review.

Slack alerts and Quackback's Slack product integration are intentionally deferred
to a separate specification.

## 20. Risks and Mitigations

### Single-host availability

An instance failure takes Quackback offline until restoration.

Mitigation: fail open in Envoy, use health monitoring, daily snapshots, nightly
logical backups, and a tested restore runbook.

### Resource pressure

The app, PostgreSQL, Dragonfly, and MinIO share 2 GB RAM.

Mitigation: monitor memory and restarts, limit initial integrations, disable AI,
and move to the pre-priced 4 GB tier when evidence warrants it.

### Sensitive screenshots or bug details

Users may accidentally submit project or account information.

Mitigation: show submission guidance, moderate Bug Reports before publication,
keep the portal private, restrict team access, and support deletion.

### Secret mismatch or rotation gap

Quackback invalidates the previous widget secret immediately when regenerated.

Mitigation: use a coordinated runbook, schedule rotation during a small
maintenance window, update Envoy SSM/runtime immediately, and verify identity
before ending the window.

### Upstream change

SDK commands, environment variables, migrations, or requirements may change.

Mitigation: pin versions/digests, review release notes, test locally, back up
before upgrades, and avoid `latest`.

### No email delivery

Users receive no email updates, and email-based Quackback admin recovery is
unavailable.

Mitigation: make this explicit in product expectations, keep secure admin
access/recovery procedures, and revisit notifications with the future Slack
integration.

### AGPL obligations

Future source modifications or tighter code bundling could change obligations.

Mitigation: keep Quackback unmodified and separately deployed, load its SDK at
runtime, retain notices, and require review before changing that boundary.

## 21. Acceptance Criteria

The implementation is complete when:

- An eligible signed-in Envoy user sees the bottom-right launcher.
- A new user sees it after registration and required consent are complete.
- A guest or consent-incomplete user does not load the SDK or see the launcher.
- Opening the widget does not request another sign-in.
- Quackback identifies the user by stable Envoy UUID and current email.
- Feature Requests and Bug Reports are available with the approved permissions.
- Users can browse, search, vote, comment, and submit.
- Bug reports can include screenshots and enter moderation.
- Changelog and roadmap are available without another login.
- Anonymous interaction and anonymous portal access are rejected.
- Logout/account switching cannot leak the previous user's state.
- Quackback or SDK failure does not block or break Envoy.
- The production host uses HTTPS and exposes no datastore ports.
- The production image is pinned to a reviewed version/digest.
- AI, telemetry, email, help, and chat are disabled.
- Backups complete and a restore test has passed.
- The Privacy Policy and deletion runbook are updated.
- Expected recurring cost remains within the approved $16 monthly ceiling.
- Unit, functional, UI, local integration, accessibility, and infrastructure
  checks pass.

## 22. Implementation File Map

Expected `envoy-project-management` changes:

- `.env.example`
- `start/env.ts`
- `start/routes.ts`
- `config/inertia.ts`
- `app/controllers/api/feedback_controller.ts`
- `app/services/quackback_widget_service.ts`
- `inertia/components/feedback_widget.svelte`
- `inertia/utils/quackback.ts`
- Authenticated shell components
- Unit, functional, and Playwright tests
- `docs/development/local-development.md`
- `docs/development/docker.md`
- `docs/legal/Privacy Policy.md`

Expected `envoy-infrastructure` changes:

- A dedicated Lightsail stack or construct.
- `bin/app.ts`
- Envoy dev/prod ECS task environment and SSM secret wiring.
- Feedback-host bootstrap and operations documentation.

Exact filenames may follow repository conventions, but the responsibilities and
boundaries in this specification must remain intact.

## 23. Source Documentation

Reviewed July 23, 2026:

- [Quackback feedback widget](https://quackback.io/docs/widget)
- [Widget installation and SDK commands](https://quackback.io/docs/widget/installation)
- [Verified user identity](https://quackback.io/docs/widget/identify-users)
- [Widget metadata](https://quackback.io/docs/widget/metadata)
- [Widget events](https://quackback.io/docs/widget/events)
- [Self-hosting overview](https://quackback.io/docs/self-hosting/overview)
- [Docker deployment](https://quackback.io/docs/self-hosting/docker)
- [System requirements](https://quackback.io/docs/self-hosting/requirements)
- [Reverse proxy](https://quackback.io/docs/self-hosting/reverse-proxy)
- [Environment variables](https://quackback.io/docs/reference/environment-variables)
- [Declarative configuration](https://quackback.io/docs/self-hosting/config-file)
- [Portal access and widget sign-in](https://quackback.io/docs/admin/portal-auth)
- [Boards and permissions](https://quackback.io/docs/admin/boards)
- [Moderation](https://quackback.io/docs/admin/moderation)
- [Statuses](https://quackback.io/docs/admin/statuses)
- [Privacy and data handling](https://quackback.io/docs/admin/privacy)
- [Quackback repository and AGPL license](https://github.com/QuackbackIO/quackback)
- [Quackback v0.13.1 release](https://github.com/QuackbackIO/quackback/releases/tag/v0.13.1)
- [Quackback v0.13.1 production Compose](https://github.com/QuackbackIO/quackback/blob/v0.13.1/docker-compose.prod.yml)
- [Quackback security advisory GHSA-37j5-56x4-3mxh](https://github.com/QuackbackIO/quackback/security/advisories/GHSA-37j5-56x4-3mxh)
- [Dragonfly v1.27.1 license](https://github.com/dragonflydb/dragonfly/blob/v1.27.1/LICENSE.md)
- [Amazon Lightsail bundles](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html)
- [Amazon Lightsail billing, snapshots, and static IP pricing](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html)
