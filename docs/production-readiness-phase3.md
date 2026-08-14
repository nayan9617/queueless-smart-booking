# QueueLess — Phase 3 Release Candidate Validation Report

**Date:** 2026-08-13  
**Baseline:** Phase 2 (`READY FOR CONTROLLED PRIVATE BETA`)  
**Standard:** Evidence-only. No status upgrade without executed tests.

---

## VERIFIED

| Item | Evidence |
|------|----------|
| Razorpay **Test Mode** order create | Live API order `amount=100 INR` created with configured test keys |
| HMAC signature accept/reject | `verifyRazorpaySignature` true for valid HMAC, false for bad sig |
| Invalid signature does **not** confirm | Live `verify-payment` → 400; booking stays unpaid/pending |
| Valid signature confirms; duplicate idempotent | Live confirm → `confirmed`/`paid`; second verify → 200 already paid |
| No webhook handler | Documented + asserted in payment test (client `verify-payment` is the authority) |
| Atomic chair capacity under concurrency | 5 parallel starts on 1-chair salon → **exactly 1** `200`, rest `409`; DB `in-progress=1` |
| Pending expiry (deterministic) | Backdated pending → `expireStalePendingBookings` → `cancelled` + `paymentStatus=failed` |
| Real browser customer journey | Playwright: homepage → Find Salon → signup → test-verify → login → search → book → demo pay → dashboard |
| Dual-browser realtime UI | Customer + owner contexts; start/complete reflected in customer UI; refresh still consistent |
| Mobile viewports 375×812 & 390×844 | Overflow checks < 8–24px on home/salons/owner dashboard |
| Security regressions | Missing/malformed/expired JWT; salon list no owner email; socket unauth + join_salon deny |
| Backend suite | **28 passed, 0 failed** |
| Playwright suite | **14 passed, 0 failed** |
| ML fallback smoke + `/health` | Pass; `model_loaded=true` (metrics still include synthetic — see honesty) |
| Backend + frontend builds | `tsc` / Vite build OK |
| Backend + frontend lint | `npm run lint` exits 0 (frontend: 1 intentional warning on ThemeContext hook export) |
| Final A–D simulation | Start A/B, complete B, start D, no-show C, cancel-in-progress rejected, complete A — OK |
| Owner analytics MVP | `GET /bookings/salon-analytics` + dashboard strip |

---

## PARTIALLY VERIFIED

| Item | Why partial |
|------|-------------|
| Razorpay **checkout.js widget** in browser | Not automated — iframe/bank UI is unreliable in Playwright. Backend-authoritative path verified instead. |
| Payment cancelled / network-drop UI paths | Backend reject/idempotency covered; full modal dismiss UX not Playwright-automated |
| Socket reconnect mid-owner-action | Refresh after complete verified; forced disconnect/reconnect not separately timed |
| Pending expiry TTL wall-clock | Deterministic backdate + job function verified; production minute-job not waited live |
| Business hours | `open`/`closed`/`break` gate bookings; **no weekly schedule** |
| Uploads in deploy | Validation/safe names verified in code; persistence still requires volume (documented) |
| Rate limiting multi-instance | Single-instance OK; Redis not introduced (documented) |

---

## NOT VERIFIED

| Item | Reason |
|------|--------|
| Live money / live Razorpay keys | Intentionally not used |
| Razorpay webhook duplicate delivery | **No webhook endpoint exists** |
| Organic ML accuracy on real salons | Holdout metrics include synthetic fill — **Production accuracy not yet established due to insufficient organic booking history.** |
| Multi-node horizontal scale | Not tested |
| Email deliverability to real inboxes | E2E uses `ALLOW_TEST_EMAIL_VERIFY` |
| Exhaustive owner staff/services mobile UX | Spot-checked dashboard overflow only |

---

## FIXED (Phase 3)

1. **Chair race** — replaced count-then-start with atomic `Salon.inProgressCount` claim/release (`chairCapacity.ts`).
2. **Razorpay env read-at-import** — lazy key reads so Test Mode works after dotenv.
3. **ESLint** — backend `.eslintrc.cjs` + frontend config so `npm run lint` runs.
4. **Test email verify** — gated `POST /api/auth/test/verify-email` for browser E2E.
5. **Browser journey flake** — modal-scoped service click (overlay interception).
6. **Mobile overflow** — `overflow-x-hidden` / `min-w-0` on app layout.
7. **Owner analytics** — simple today totals + averages API + UI strip.

---

## REMAINING RISKS (10–20 real users)

What can still go wrong:

1. **User closes Razorpay after paying** before `verify-payment` — booking may stay pending until manual retry or support; **no webhook recovery**.
2. **`ALLOW_DEMO_PAY=true` in a shared env** would skip real Test Mode checkout — must be `false` for payment beta.
3. **`ALLOW_TEST_EMAIL_VERIFY=true`** must be disabled outside local/CI.
4. **Upload disk** lost on redeploy without a persistent volume.
5. **In-memory rate limits** ineffective with >1 backend instance.
6. **Salon status only** (no weekly hours) — overnight open/closed mistakes.
7. **ML wait times** may feel “off” — physics fallback is safe, accuracy not proven on organic data.
8. **Chair counter desync** if DB manually edited or process crashes between claim and booking update (release-on-failure covers the common path).
9. **One salon per owner** unique index remains a product constraint.
10. **Email/SMS deliverability** for real users depends on Gmail/app credentials.

---

## Tests executed (commands + results)

```text
cd backend && npm test
→ 28 passed, 0 failed

cd frontend && npm run test:e2e
→ 14 passed (browser journey, dual realtime, mobile×2, prior Phase 2 suite)

cd backend && npm run lint
→ exit 0

cd frontend && npm run lint
→ exit 0 (1 warning: ThemeContext hook export)

cd backend && npm run build
→ tsc OK

cd frontend && npm run build
→ vite build OK

cd ml-service && ./venv/bin/python tests/test_fallback.py
→ ml smoke ok

curl http://localhost:8000/health
→ ok, model_loaded=true (n_real reported in metrics file; synthetic still present)

cd backend && npx tsx src/scripts/phase2Simulation.ts
→ simulation OK (A–D scenario)
```

---

## Scores

| Area | Score | Note |
|------|------:|------|
| Customer Experience | **8**/10 | Real browser journey + demo/Razorpay path; widget UI not CI-covered |
| Salon Owner Experience | **8**/10 | No-show, analytics strip, capacity guard |
| Backend Reliability | **8.5**/10 | Atomic chairs, expiry, request IDs |
| Security | **8**/10 | Socket JWT + regressions; test-verify flag risk if left on |
| Queue Correctness | **9**/10 | Math + concurrent start invariant proven |
| Realtime Reliability | **8**/10 | Dual-browser UI updates verified |
| Payment Reliability | **7**/10 | Test Mode HMAC path verified; **no webhooks**; widget not automated |
| ML Readiness | **6**/10 | Fallback/health OK; organic accuracy not established |
| Automated Testing | **8.5**/10 | 28 backend + 14 Playwright |
| Mobile UX | **7.5**/10 | Overflow checks pass; not full journey on phone |
| **Overall** | **8**/10 | Stronger RC than Phase 2; still not public-prod |

---

## Final release decision

```text
READY FOR CONTROLLED PRIVATE BETA
```

**Not** `READY FOR PUBLIC PRODUCTION` — missing webhook recovery, durable uploads, multi-instance rate limits, organic ML proof, and automated Razorpay widget coverage.

**Not** `NOT READY` — Phase 3 closed the highest-risk gaps with evidence (atomic capacity, payment HMAC Test Mode, real browser journey, dual realtime UI, deterministic expiry, lint/builds green).

### Private beta checklist

- Set `ALLOW_DEMO_PAY=false` when exercising Razorpay Test Mode with users  
- Set `ALLOW_TEST_EMAIL_VERIFY=false` outside CI/local  
- Single backend instance **or** accept rate-limit gap  
- Mount persistent volume for `backend/uploads`  
- Invite 10–20 users; watch pending bookings + payment verify failures  
- Treat ML ETAs as advisory until organic history accumulates  
