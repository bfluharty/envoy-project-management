# Production Rate Limiting Guide

Envoy protects paid Foursquare and OpenAI-backed routes with two layers in production:

1. AWS WAF blocks high-volume IP abuse at CloudFront before traffic reaches the application.
2. The application enforces user-, project-, session-, and IP-scoped quotas in Postgres before it calls Foursquare or the reasoning engine.

The application limiter is prod-only. `RateLimitService` enforces limits only when `APP_ENV=prod`; dev, local, and normal test runs are no-ops.

## Protected Routes

| Route                                                                  | Paid dependency             | WAF prod limit                | Application limits                                                                       |
| ---------------------------------------------------------------------- | --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| `POST /onboarding/vendor-search`                                       | Foursquare                  | 100 requests / 5 minutes / IP | 2 / hour / anonymous session, 5 / day / anonymous session, 10 / hour / IP, 30 / day / IP |
| `POST /api/vendors/search`                                             | Foursquare                  | 100 requests / 5 minutes / IP | 20 / hour / user, 60 / hour / IP                                                         |
| `POST /projects/:uuid/chat`                                            | OpenAI via reasoning engine | 100 requests / 5 minutes / IP | 30 / hour / user, 100 / day / user, 50 / day / project, 120 / hour / IP                  |
| `POST /api/projects/:uuid/chat`                                        | OpenAI via reasoning engine | 100 requests / 5 minutes / IP | 30 / hour / user, 100 / day / user, 50 / day / project, 120 / hour / IP                  |
| `GET /projects/:uuid/greeting`                                         | OpenAI via reasoning engine | 100 requests / 5 minutes / IP | 30 / hour / user, 100 / day / user, 50 / day / project, 120 / hour / IP                  |
| `POST /api/projects/:uuid/outreach/drafts/:draftUuid/revise`           | OpenAI                      | 100 requests / 5 minutes / IP | 20 / hour / user, 75 / day / user, 50 / day / project, 120 / hour / IP                   |
| `POST /api/projects/:uuid/outreach/threads/:threadUuid/replies/revise` | OpenAI                      | 100 requests / 5 minutes / IP | 20 / hour / user, 75 / day / user, 50 / day / project, 120 / hour / IP                   |

The existing broad WAF rule remains in place at 2,000 requests per 5-minute evaluation window per IP.

## Runtime Behavior

When a route exceeds an application quota, Envoy returns:

```json
{
  "error": "Too many requests",
  "retryAfterSeconds": 1234
}
```

The response also includes a `Retry-After` header. The limiter runs before the paid service call, so blocked requests do not call Foursquare, OpenAI, or the reasoning engine.

The current API admin/testing model stays intact. Routes that use `x-user-id` still accept it; the limiter uses that user ID plus the client IP.

## Deployment Checklist

1. Deploy and run the `rate_limit_buckets` migration before sending prod traffic to the new app code.
2. Deploy `EnvoyProdStackEast` so the prod CloudFront WAF receives the scoped route rules.
3. Confirm prod containers have `APP_ENV=prod`. Dev containers intentionally keep `APP_ENV=dev`, so app-side quotas stay disabled there.
4. Watch the WAF CloudWatch metrics:
   - `AnonymousVendorSearchRateLimit`
   - `ApiVendorSearchRateLimit`
   - `ProjectChatRateLimit`
   - `ProjectGreetingRateLimit`
   - `OutreachAiRevisionRateLimit`
   - `RateLimit`
5. Watch application logs for `429` responses and customer support reports before tightening limits further.

For stronger IP attribution, configure CloudFront to forward the generated `CloudFront-Viewer-Address` header to the origin. The application already prefers that header when present.

## Tuning Guidance

Keep the WAF limits higher than the application limits. WAF is a coarse abuse shield keyed by IP; the application quotas understand users, projects, anonymous sessions, and daily windows.

Increase limits if legitimate customers hit `429` during normal workflows. Decrease limits if CloudWatch sampled requests show scraping, replay, or automation against paid routes.

The Postgres table stores one row per bucket and fixed window. Add a scheduled cleanup job if table growth becomes visible, for example deleting rows with `updated_timestamp < NOW() - INTERVAL '7 days'`.

The current ALB security group still allows direct internet ingress. For the next infrastructure hardening pass, restrict the ALB origin to CloudFront origin-facing traffic, or require a CloudFront-only origin verification header at the ALB listener. That prevents attackers from bypassing the CloudFront WAF by calling the ALB DNS name directly.

## Not Included Yet

CAPTCHA is intentionally not included.

Provider budget ceilings are not included. If needed later, add separate daily spend guards keyed to Foursquare/OpenAI usage or billing telemetry; those should complement, not replace, route-level limits.
