# QueueLess — Phase 2 Production Hardening Report

**Date:** 2026-08-13  
**Baseline:** Phase 1 report (`docs/production-readiness-report.md`) — MVP ~6.5/10  
**Standard:** Evidence-only. Scores and beta recommendation follow executed tests only.

---

## 1. Changes Made

| Area | Files | Change |
|------|-------|--------|
| Socket.IO JWT auth | `backend/src/socket.ts`, `frontend/src/socket.ts`, `Dashboard.tsx` | Handshake JWT required; auto-join `user:{authId}`; `join_salon` ownership/active-booking check; legacy `join_user` no-op |
| Pending expiry | `pendingExpiryService.ts`, `app.ts` | Minute job cancels stale unpaid pending after `PENDING_BOOKING_TTL_MINUTES` |
| No-show | `Booking.ts`, `bookingController.ts`, `OwnerDashboard.tsx` | `no-show` status; owner-only transitions; queue recalculation; UI action |
| Payment / concurrency | `bookingController.ts` | Atomic `findOneAndUpdate` pending→confirmed; demo pay via `ALLOW_DEMO_PAY`; chair capacity 409 on excess `in-progress` |
| Pagination | `salonController.ts`, `bookingController.ts`, `Salons.tsx`, `Dashboard.tsx` | `{ data, pagination }` envelopes; frontend unwrap |
| ML | `ml-service/app/main.py` | `/health`, `/reload`; train reloads in-memory model |
| Observability | `logger.ts`, `requestIdMiddleware.ts`, `app.ts` | Request IDs; structured logs; no stack traces to clients |
| Rate limit | `rateLimitMiddleware.ts`, env | Optional `DISABLE_RATE_LIMIT` for local E2E |
| E2E | `frontend/playwright.config.ts`, `e2e/*` | Playwright customer/owner/authz/idempotency + concurrency |
| Tests | `socket.auth.test.ts`, `security.regression.test.ts`, `booking.concurrency.test.ts`, `ml-service/tests/test_fallback.py` | Live API + unit coverage |
| Cleanup | `scripts/cleanupAuditJunk.ts` | Removed `audit.*` users + Hacked Salon |
| Docs | `docs/environment.md` | Demo pay, TTL, uploads persistence, indexes, rate-limit multi-instance, ML synthetic caveat |
| Simulation | `scripts/phase2Simulation.ts` | A–D queue / no-show / capacity scenario |

---

## 2. Bugs Fixed

| Bug | Reproduction | Root cause | Fix |
|-----|--------------|------------|-----|
| Frontend Vite crash on Socket export | Import `socket` after rename | Redeclared `socket` binding | Renamed singleton to `singleton` |
| Socket private rooms trust client `userId` | Emit `join_user` with any id | No JWT on handshake | JWT middleware + server-derived room |
| Duplicate payment confirm races | Parallel `verify-payment` | Non-atomic status update | `findOneAndUpdate` with pending precondition |
| Over-capacity concurrent starts | 1-chair salon, start 2nd `in-progress` | No chair check | Count in-progress vs chairs → 409 |
| E2E helpers missing `email` | Concurrency bookPay | Return type omitted email | Return `email` from `registerAndLogin` |
| Backend tests skipped env / hung | `npm test` | Wrong dotenv path; mongoose kept process alive; glob missed root tests | Path `../../.env`; `after` disconnect; quoted glob + `--test-force-exit` |
| Auth rate limit broke E2E | Many register/login | In-memory limiter | `DISABLE_RATE_LIMIT` for local |

---

## 3. Tests Added

| Test | Purpose |
|------|---------|
| Socket: rejects unauthenticated | No JWT → connect_error |
| Socket: accepts valid JWT | Connect succeeds |
| Socket: join_salon denied | Random salon without booking → ack.ok=false |
| Security: missing/malformed/expired JWT | 401 |
| Security: salon list no owner email + pagination | Envelope + scrub |
| Concurrency: duplicate verify-payment | Idempotent paid/confirmed |
| Concurrency: no-show then start | 400 |
| Concurrency: chair capacity | Second start → 409 |
| Pending expiry export smoke | Function present |
| Playwright customer↔owner flow | Setup, book, pay, start/complete, dashboards, authz, idempotency |
| Playwright homepage CTA | UI smoke |
| Playwright concurrency | Two confirmed; serialized chair start |
| ML `test_fallback.py` | Physics path without model; invalid input clamped |

---

## 4. Tests Executed (actual)

```text
cd backend && npm test
→ 23 passed, 0 failed

cd frontend && npm run test:e2e
→ 9 passed (Playwright chromium)

cd ml-service && ./venv/bin/python tests/test_fallback.py
→ ml smoke ok

curl http://localhost:8000/health
→ ok, model_loaded=true (metrics include synthetic samples — not claimed as organic accuracy)

cd backend && npm run build
→ tsc OK

cd frontend && npm run build
→ vite build OK

cd backend && npx tsx src/scripts/cleanupAuditJunk.ts
→ Deleted 3 audit users, related bookings/salons; Hacked Salon removed with owner cascade

cd backend && npx tsx src/scripts/phase2Simulation.ts
→ A–D booked; A+B in-progress; B complete; D start; C no-show; D cancel rejected while in-progress; A complete; simulation OK

cd backend && npm run lint
→ NOT VERIFIED (no ESLint config file in repo — pre-existing)
```

### Verification legend

| Item | Status |
|------|--------|
| Socket.IO JWT private rooms | **Verified** (automated) |
| Customer/owner E2E (API + UI dashboards) | **Verified** (Playwright) |
| Full click-through checkout UI (Razorpay widget) | **Not verified** (demo pay path used; `ALLOW_DEMO_PAY=true`) |
| Razorpay Test Mode signatures/webhooks | **Not verified** |
| Cross-user Socket ETA UI live assertion | **Partially verified** (auth + rooms tested; UI invalidate path present, not assertively timed in Playwright) |
| Pending expiry job | **Partially verified** (code + job start; unit smoke only; TTL not waited in CI) |
| No-show + capacity | **Verified** (live API + simulation) |
| ML organic accuracy | **Not verified** (synthetic-influenced metrics only) |
| Responsive UI matrix (tablet/mobile) | **Not verified** this phase |
| ESLint | **Not verified** (no config) |

---

## 5. Remaining Known Issues

1. **Razorpay Test Mode end-to-end** not executed with real Test Mode checkout UI / webhooks.
2. **Hard Mongo transactions** not used for chair start (count-then-update can race under extreme parallel starts; 409 soft lock is best-effort).
3. **Business hours / analytics** still missing.
4. **Uploads** still local disk — needs volume/object storage for durable deploy.
5. **Rate limiter** in-memory — not safe across multiple Node instances without Redis/edge limits.
6. **One salon per owner** unique index remains a product constraint.
7. **Playwright** flows lean on API setup + auth injection for speed; not a full browser signup→mailbox verify path.
8. **createSalon** still initializes `staff: []` even if body sends staff (staff added via staff APIs) — simulation showed empty staff; capacity falls back to chairs.
9. **ML metrics** must not be marketed as production accuracy until organic data dominates.
10. **No ESLint config** — `npm run lint` cannot run meaningfully.

---

## 6. Production Readiness Scores

| Dimension | Phase 1 ~ | Phase 2 | Notes |
|-----------|-----------|---------|-------|
| Customer Experience | 7 | **7.5**/10 | Demo pay works; full Razorpay UI unverified |
| Salon Owner Experience | 7 | **8**/10 | No-show + capacity guard |
| Backend Reliability | 6.5 | **8**/10 | Expiry job, atomic confirm, request IDs |
| Security | 6 | **8**/10 | Socket JWT + regression tests |
| Queue Correctness | 8 | **8.5**/10 | Prior math + capacity + simulation |
| ML Readiness | 5 | **6**/10 | Health/reload/fallback tested; organic accuracy not |
| Automated Testing | 4 | **7.5**/10 | 23 backend + 9 Playwright + ML smoke |
| **Overall MVP** | **6.5** | **7.5**/10 | |

---

## 7. Beta Recommendation

```text
READY FOR CONTROLLED PRIVATE BETA
```

**Evidence basis:** Socket auth verified; booking idempotency/capacity/no-show verified; Playwright suite green under demo pay; audit junk cleaned; builds pass.

**Not** public production: Razorpay Test Mode UI/webhooks unverified, upload persistence, multi-instance rate limits, business hours, and organic ML validation remain open.

**Private beta conditions:** `ALLOW_DEMO_PAY` or carefully configured Razorpay Test Mode; persistent upload volume; single backend instance or shared rate-limit store; known invite-only users; monitor pending-expiry and payment logs.
