# Environment

Root `.env` values used across the stack:

- `PORT` - Backend port, default `5001`.
- `MONGO_URI` - MongoDB connection string.
- `JWT_SECRET` - Token signing secret.
- `CLIENT_URL` - Frontend URL used in emails and verification links.
- `EMAIL_USER` - Gmail account used for notifications.
- `EMAIL_PASS` - App password for the email account.
- `ML_SERVICE_URL` - Wait-time prediction service URL (**required in production** for accurate estimates; fallback is physics-only).
- `DB_NAME` - Optional Mongo DB name for the ML service (defaults to `queueless`).
- `GOOGLE_CLIENT_ID` - Google OAuth Web Client ID (backend token verification).
- `VITE_GOOGLE_CLIENT_ID` - Same Google Client ID for the frontend Google button (put in `frontend/.env` as well for Vite).
- `RAZORPAY_KEY_ID` - Razorpay Key ID (use `rzp_test_...` for free Test Mode).
- `RAZORPAY_KEY_SECRET` - Razorpay Key Secret (Test Mode secret from dashboard).
- `ALLOW_DEMO_PAY` - When `true`, booking uses demo payment even if Razorpay keys exist (local E2E / private beta). Set `false` for real Test Mode / live checkout.
- `PENDING_BOOKING_TTL_MINUTES` - Unpaid pending bookings auto-cancel after this many minutes (default `20`, minimum `5`).
- `APP_ENV` - `local` | `beta` | `production`. In `beta`/`production` (or `NODE_ENV=production`), dangerous flags are ignored.
- `BETA_OPS_SECRET` - Header `x-beta-ops-key` for `GET /api/ops/beta-stats` (founder snapshot, no PII). Leave empty to disable.
- `DISABLE_RATE_LIMIT` - When `true`, skips auth/booking rate limiters (local load testing / E2E only). Leave unset/`false` in shared environments.
- `ALLOW_TEST_EMAIL_VERIFY` - Local/E2E only. Enables `POST /api/auth/test/verify-email`.
- `VITE_API_URL` - Optional frontend override for the API base URL.

**Dangerous flags (never true for real testers):** `ALLOW_DEMO_PAY`, `ALLOW_TEST_EMAIL_VERIFY`, `DISABLE_RATE_LIMIT`. Safe default is `false`. See `docs/beta-playbook.md`.

## Rate limiting

Auth and booking-create limits use an **in-memory** store (`express-rate-limit`).  
For multi-instance production, configure a shared store (e.g. Redis) or terminate rate limits at the edge/load balancer. Current defaults: auth 40 / 15 min; booking create 8 / min.

## Indexes (why they exist)

| Index | Model | Why |
|-------|--------|-----|
| `{ ownerId: 1 }` unique | Salon | One salon per owner (enforced at create) |
| text `name`+`address` | Salon | Name/address search |
| `{ rating: -1 }` | Salon | Default discovery sort |
| `{ userId, bookingTime }` | Booking | Customer history / pagination |
| `{ salonId, status, paymentStatus, bookingTime }` | Booking | Queue + owner dashboard queries |
| `{ salonId, status, actualStartTime }` | Booking | In-progress / capacity checks |
| unique `{ userId, clientRequestId }` sparse | Booking | Idempotent create |

Nearby sort currently uses in-app Haversine (no `2dsphere` yet). Add geo index only if moving to `$geoNear`.

## ML data quality note

Holdout metrics in `ml-service/data/model_metrics.json` / `/health` include **synthetic fill**. Treat them as pipeline sanity checks, not production accuracy claims. Organic completed bookings must dominate before advertising wait-time quality.


## Business hours (MVP)

Salon `status` is `open` | `closed` | `break`. Booking create rejects `closed`/`break`.  
There is **no weekly hours schedule** yet — owners toggle salon status manually. Documented as post-beta if recurring hours are required.

## Rate limiting (deployment)

In-memory limiter is safe for **single-instance private beta** only. Multi-instance requires Redis/edge limits. Set `DISABLE_RATE_LIMIT=true` only for local E2E.

## Test email verify

`ALLOW_TEST_EMAIL_VERIFY=true` enables `POST /api/auth/test/verify-email` for Playwright. **Disable in public production.**

## Razorpay

- Order create + HMAC verify are backend-authoritative.
- **No webhook handler** — confirmation requires client `verify-payment` with valid signature (or demo when `ALLOW_DEMO_PAY=true`).
- Full `checkout.js` widget UI is not reliably automatable in CI; Test Mode order+signature path is covered by backend tests.

