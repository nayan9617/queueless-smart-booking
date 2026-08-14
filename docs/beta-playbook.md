# QueueLess — Private Beta Playbook

For 5–10 real testers. Not a public launch checklist.

## Beta Readiness

Safe to expose to a small invited group if:

- `APP_ENV=beta` (or `NODE_ENV=production`)
- `ALLOW_DEMO_PAY`, `ALLOW_TEST_EMAIL_VERIFY`, `DISABLE_RATE_LIMIT` are **false** (strict runtime ignores them even if true)
- Razorpay **Test Mode** keys only (`rzp_test_…`)
- Single backend instance (in-memory rate limits)
- Persistent volume for `backend/uploads` if photos matter
- `JWT_SECRET` is unique and not `change-me`
- `BETA_OPS_SECRET` set so you can read `/api/ops/beta-stats`

Do **not** invite paying live-money users. Test Mode only.

Seed salons: `cd backend && npx tsx src/scripts/seedBetaSalons.ts`

- Salon A: 3 chairs, 2 staff, Haircut 40 / Beard 20 / Facial 60  
  Login: `beta.salon.a@queueless.local` / `BetaSalon!24`
- Salon B: 1 chair, 1 staff, shorter menu  
  Login: `beta.salon.b@queueless.local` / `BetaSalon!24`

Change those passwords before sharing with real owners.

## Environment Checklist

| Variable | Beta value |
|----------|------------|
| `APP_ENV` | `beta` |
| `JWT_SECRET` | strong unique secret |
| `MONGO_URI` / `DB_NAME` | dedicated beta DB if possible |
| `CLIENT_URL` | public frontend URL |
| `EMAIL_USER` / `EMAIL_PASS` | working mailbox |
| `ML_SERVICE_URL` | running ML service |
| `RAZORPAY_KEY_ID` | `rzp_test_…` |
| `RAZORPAY_KEY_SECRET` | Test Mode secret |
| `PENDING_BOOKING_TTL_MINUTES` | `20` |
| `BETA_OPS_SECRET` | random string |
| `ALLOW_DEMO_PAY` | `false` |
| `ALLOW_TEST_EMAIL_VERIFY` | `false` |
| `DISABLE_RATE_LIMIT` | `false` |

Health:

- Frontend: load the site (HTTP 200)
- Backend: `GET /health` → `{ ok, services: { api, mongo, ml } }`
- ML: `GET {ML_SERVICE_URL}/health`

Founder snapshot (no PII):

```bash
curl -H "x-beta-ops-key: $BETA_OPS_SECRET" https://YOUR_API/api/ops/beta-stats
```

## Monitoring Checklist

Watch during sessions:

1. `payment_verification_failed` / `booking remains pending` after Razorpay
2. `ml_prediction_fallback` frequency
3. `socket_auth_failed`
4. `rate_limit_rejected` (real users hitting limits?)
5. `booking_duplicate_blocked` / idempotency replays
6. `/api/ops/beta-stats` pendingUnpaid vs confirmed vs inProgress
7. Email verification friction (inbox delay)
8. Owner confusion on Start / Complete / No-show

Trace one booking in logs via `requestId` → `bookingId` → `salonId`:

`signup/login → salon_search → salon_viewed → booking_created → payment_initiated → payment_verification_* → booking_confirmed → queue_recalculated → service_started → service_completed`

## Known Risks

1. User pays then closes Razorpay before verify → **stuck pending**; no webhook recovery. Ask them to retry Pay / contact you with booking id.
2. Uploads vanish without a persistent volume.
3. Multi-instance deploy breaks rate limits and in-memory counters.
4. ETA is **advisory**. Do not promise accuracy.
5. One salon per owner.
6. No weekly business hours — owners must toggle open/closed.
7. Test email verify and demo pay must stay off.

## User Feedback Checklist

Ask testers after they try (don’t over-guide the UI):

### Discovery
- Did you immediately understand what QueueLess does?

### Trust
- Did you trust the wait estimate?

### Booking
- Was booking understandable end-to-end?

### ETA language
- Which is clearer: “Come in ~30 minutes” vs “Queue position #4”?

### Owner
- Could you run the queue without help?

### Realtime
- Did you notice the queue/ETA update without refreshing?

### Search / location
- Could you find the salon you wanted?
- Did nearby/distance make sense?

## Metrics to Collect

From `/api/ops/beta-stats` + logs + this incident log:

| Metric | Where |
|--------|--------|
| Signup → booking conversion | `signup` vs `booking_confirmed` events |
| Cancellation rate | cancelled / confirmed |
| Avg predicted wait | `predictedWaitMinutes` on organic bookings |
| Avg actual wait | `actualWaitMinutes` on completed organic bookings |
| Prediction error | actual − predicted (organic only) |
| Payment verify failures | `processCounters.paymentVerifyFailed` + pendingUnpaid |
| Booking failures | 4xx/5xx on `/api/bookings` |
| No-shows | `bookings.noShow` |
| ML fallback frequency | `processCounters.mlFallback` / `mlRequested` |
| Realtime failures | testers reporting no live update + `socket_auth_failed` |

**Do not publish ML accuracy.** After enough organic completes, compute MAE on `actualWaitMinutes` vs `predictedWaitMinutes` offline.

## Tester scenarios (observe, don’t script every click)

**Customer:** create account → find/search/compare salons → open salon → understand services → book → pay (Test Mode) → read ETA → watch update → cancel only if still waiting.

**Owner:** login → today’s queue → start → complete → cancellation → no-show → glance at today analytics.

## Founder decision: private beta → public launch

Move to public launch only if **all** of the following are true from real usage:

1. Owners can run Start / Complete / No-show without you in the room.
2. Customers complete book+pay without a walkthrough.
3. Stuck-pending payments after Razorpay close are **rare** or you have webhook recovery.
4. Organic completed bookings exist with stored predicted vs actual wait (enough to sanity-check ETA, not necessarily “90% accurate”).
5. No P0 auth/capacity/payment integrity bugs in the incident log.
6. Uploads persist across deploy; rate limits work for your hosting shape.
7. You are willing to support live Test Mode (or live Razorpay) operationally.

Until then: stay private beta, log incidents, measure, then change the smallest thing that failed.

## Incidents

Use [beta-incident-log.md](./beta-incident-log.md).
