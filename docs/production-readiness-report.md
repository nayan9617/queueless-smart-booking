# QueueLess — Production-Readiness Report

**Date:** 2026-08-13  
**Scope:** Full-stack audit of QueueLess smart booking (frontend, backend, ML).  
**Standard:** Evidence-only. Items not executed are marked as such.

---

## A. System Understanding

QueueLess is a three-service product:

1. **Frontend** (`frontend/`): React 19 + Vite + TanStack Query + Zustand + Socket.IO client + Tailwind. Routes cover home, salons, auth, customer dashboard, checkout, owner admin dashboard.
2. **Backend** (`backend/`): Express + MongoDB/Mongoose + JWT auth + Socket.IO + Razorpay + Nodemailer + Multer uploads. Domains: auth, salons, bookings, staff, queue recalculation, ML client.
3. **ML** (`ml-service/`): FastAPI + HistGradientBoostingRegressor hybrid with physics baseline, trained on completed bookings (+ synthetic fill).

**Data model (verified in code):** `User`, `Salon` (embedded services/staff/images), `Booking`. No separate Queue collection — live queue is derived from paid `confirmed` / `in-progress` bookings via discrete-event chair simulation.

**Core booking path:** Browse salons → checkout → create pending booking → Razorpay or demo pay → confirm → queue recalculate → owner/customer socket updates.

---

## B. Customer Journey

| Flow | Status | Issues | Fix |
|------|--------|--------|-----|
| Homepage / public browse | IMPLEMENTED AND WORKING | — | — |
| Find salons (public) | IMPLEMENTED AND WORKING | Search name works (API probe) | — |
| Signup + email verify | IMPLEMENTED AND WORKING | Blocks automated E2E without mailbox | Force-verify only in local audit |
| Login / invalid creds | IMPLEMENTED AND WORKING | 401 on bad login (probed) | — |
| Protected routes | IMPLEMENTED AND WORKING | Was auth-only for admin | Role-gated admin route |
| Salon search empty | IMPLEMENTED AND WORKING | 0 results for nonsense query | — |
| Location / Near Me | PARTIALLY IMPLEMENTED | Soft geolocation prompt; not fully UI-E2E’d this run | Later |
| Book + pay | PARTIALLY IMPLEMENTED | Razorpay keys block silent demo; UI path exists | Use Test Mode checkout |
| Wait estimate on create | IMPLEMENTED AND WORKING | ML fallback if down | — |
| Est. start ≥ booking time | IMPLEMENTED AND WORKING | Was buggy; clamped | Fixed earlier + tests |
| Dashboard bookings | IMPLEMENTED AND WORKING | — | — |
| Live ETA on customer dashboard | WAS MISSING → FIXED | No socket | `join_user` + invalidate |
| Cancel own booking | IMPLEMENTED AND WORKING | Authz checked | — |
| Rating modal spam | WAS BROKEN → FIXED | Reopened endlessly | Once-per-visit + dismiss |
| Double-submit bookings | WAS BROKEN → FIXED | 3× 201 | Idempotency + 409 |

---

## C. Salon Owner Journey

| Flow | Status | Issues | Fix |
|------|--------|--------|-----|
| Register as owner | IMPLEMENTED AND WORKING | Role-specific welcome email | Fixed earlier |
| Create salon | IMPLEMENTED AND WORKING | Customers could also create | `requireSalonOwner` |
| Services / chairs / photos | IMPLEMENTED AND WORKING | Upload + album | Earlier work |
| Staff add/availability | IMPLEMENTED AND WORKING | Was open to customers | Role guard |
| Live queue dashboard | IMPLEMENTED AND WORKING | Socket + 30s poll | Emit alignment improved |
| Start / complete service | IMPLEMENTED AND WORKING | — | — |
| Override wait | IMPLEMENTED AND WORKING | Negative wait risk | Clamped ≥ booking time |
| Business hours | MISSING | No hours model | Later |
| No-show status | MISSING | No enum value | Later |
| Analytics | MISSING | — | Later |

---

## D. Security Findings

| Sev | Issue | Fix |
|-----|-------|-----|
| P0 | Customer `POST /salons` → 201 | `requireSalonOwner` — re-probed **403** |
| P0 | Customer staff APIs | Same — **403** |
| P0 | Owner email on public salon GET | Populate `name` only — re-probed |
| P0 | JWT fallback `'secret'` | Require `JWT_SECRET` |
| P0 | Auth middleware could double-send | Early returns |
| P1 | Customer could hit owner booking APIs | Role on salon-bookings / status patch |
| P1 | Frontend `/admin/dashboard` open to any auth user | `ProtectedRoute roles=` |
| P1 | No rate limiting | Auth + booking limiters added |
| P1 | Socket CORS `*` | Restricted to `CLIENT_URL` |
| P2 | Socket `join_user` not JWT-authenticated | Documented risk — harden later |
| P2 | Cross-owner salon PATCH | Already **401** (probed OK) |

---

## E. Queue Engine Findings

**Algorithm:** Multi-server discrete-event simulation over `min(chairs, availableStaff)` slots; ML blend for ETA; start time clamped to ≥ `bookingTime`.

| Concern | Assessment |
|---------|------------|
| Multiple chairs | Supported via concurrent slots |
| Different service durations | Chair free-times use per-booking duration |
| Cancellations | Recalc on cancel; capacity frees |
| Delays / early finish | Remaining time for in-progress; recalc on status change |
| Staff availability | Affects concurrent slots |
| Concurrent bookings | Soft control via per-user-salon active lock + idempotency (not DB transaction locking of chairs) |

**Automated scenario tests:** 7 math invariants covering 1-chair, 3-chair, mixed duration, cancel, overrun, staff capacity, start clamp — **all passed**.

**Not fully live-tested this run:** multi-browser Socket.IO matrix (Browser A/B/C).

---

## F. ML Findings

| Item | Reality |
|------|---------|
| Model | `HistGradientBoostingRegressor` + physics hybrid |
| Features | Queue length, barbers, duration, chairs, time, DOW, load, workload, cyclical hour, peak/weekend |
| Training | Mongo completed bookings (`mlSnapshot`) + synthetic fill |
| Validation | Holdout MAE/R² vs physics baseline stored in metrics JSON |
| Failure mode | Backend axios timeout → physics fallback |
| Limitations | Seed/synth heavy; live uvicorn may serve stale in-memory metrics until restart; not a guarantee of real-world MAE |
| Metrics claims | Do **not** advertise seed MAE as production accuracy |

---

## G. Bugs Found

| Bug | Reproduction | Root cause | Fix | Test |
|-----|--------------|------------|-----|------|
| Est. start before book time | Book; compare times | Separate clocks | Shared clock + clamp | `queueMath` / scenarios |
| Rating modal loops | Dismiss rating | Next unrated auto-open | Once + dismiss state | Manual |
| Customer creates salon | `POST /salons` as customer | No role check | `requireSalonOwner` | API 403 |
| Book when closed | Close salon; book | No status check | Reject closed/break | API 400 |
| Owner email leak | `GET /salons/:id` | populate email | name only | API probe |
| Duplicate bookings | Triple POST | No idempotency | Key + 409 active | API 201/200/409 |
| Customer no live ETA | Owner updates queue | No customer socket | `join_user` + events | Code + unit path |
| `queueService` broken mid-audit | N/A (dev) | Bad edit | Restored | tsc + tests |

---

## H. Missing MVP Features

### Must implement now — done or partial this audit
- Role authorization on owner APIs ✅  
- Closed salon booking guard ✅  
- Booking idempotency / anti-dupe ✅  
- Customer realtime updates ✅  
- Rate limiting (basic) ✅  
- Automated queue math tests ✅  

### Can implement later
- Business hours / open calendar  
- Explicit no-show status  
- Strong socket auth (JWT on handshake)  
- Chair-level transactional locking  
- Pagination on salon/booking lists  
- Playwright E2E suite  
- Owner analytics  
- Object storage for images (S3) instead of local disk  

---

## I. Tests Executed

```text
cd backend && npm test
Result: 13 passed, 0 failed
```

```text
curl http://localhost:5001/
{"message":"QueueLess API is running 🚀"}

curl http://localhost:8000/
ML Service Operational / model_loaded true

curl http://localhost:5173/
HTTP 200

# Auth
POST /api/auth/login bad creds → 401
GET /api/bookings/my-bookings no token → 401

# Authz
POST /api/salons as customer → 403
POST /api/staff as customer → 403
PATCH other owner's salon → 401

# Booking rules
POST book closed salon → 400
Idempotent POST same key → 201 then 200 reused=true
Second distinct booking while pending → 409

# Prior npm test (before fix)
jest: command not found
```

**Not executed:** Playwright/Cypress full UI journeys; multi-browser realtime matrix; Razorpay live charge (keys present — requires Test Mode UI).

---

## J. Production Readiness Score

| Area | Score | Explanation |
|------|-------|-------------|
| Customer experience | **6.5/10** | Core path solid; payment needs Razorpay Test Mode; location UX partial |
| Salon owner experience | **7/10** | Queue + staff + settings usable; hours/no-show/analytics missing |
| Backend reliability | **6.5/10** | Idempotency + indexes + rate limits added; no full transactions |
| Security | **7/10** | P0 role/PII/JWT fixed; socket join still trust-based; no WAF |
| Queue correctness | **7.5/10** | Sound simulator + tests; concurrency is soft not hard-locked |
| ML readiness | **6/10** | Real hybrid + fallback; seed-biased; restart after train |
| Testing | **5/10** | 13 unit/scenario tests; no E2E automation yet |
| **Overall MVP readiness** | **6.5/10** | Soft-launch / private beta possible with monitoring; **not** unrestricted public production |

---

## K. Remaining Risks

1. **Razorpay misconfig / failed orders** leave pending bookings (mitigated by 15‑min active window + cancel).  
2. **Socket rooms** joinable with guessed user/salon IDs (information leak / noise).  
3. **One salon per owner** unique index — fails if historical duplicate ownerIds exist.  
4. **Local uploads** lost on ephemeral hosts unless volume mounted.  
5. **Email deliverability** required for verify — Google OAuth path bypasses.  
6. **No hard capacity lock** under extreme simultaneous paid confirms.  
7. **ML accuracy** not proven on organic traffic.  
8. Audit created test users/salons (`audit.*`, “Hacked Salon”) still in DB.

---

## L. Recommended Next Steps

### 1. Critical
- Authenticate Socket.IO joins with JWT.  
- Mount persistent volume for `backend/uploads` in deploy.  
- Restart ML after train; wire healthcheck to `/metrics`.  
- Clean audit junk data in Mongo.

### 2. Important
- Playwright: signup→book→owner complete→rate.  
- Paginate `GET /salons` and booking lists.  
- Expire stale `pending` bookings via cron.  
- Add `no-show` status + owner action.

### 3. Later
- Business hours, deposits, multi-branch owners, Redis rate-limit store, object storage images.

---

## Bottom line

> If real customers and salons used QueueLess tomorrow, the worst failures would have been **authorization holes**, **duplicate bookings**, **closed-salon bookings**, **PII on public APIs**, and **stale customer ETAs**. Those are addressed and re-probed. Remaining gaps are **payment E2E under Razorpay**, **hard concurrency**, **socket auth**, and **automated UI E2E** — enough to block a confident “production ready” claim, but the product is substantially closer to a controlled beta.
