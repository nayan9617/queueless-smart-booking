# Production Readiness Audit — Working Notes

Started: 2026-08-13. This document tracks executed evidence. It is not a claim of full production readiness.

## Services verified running

| Service | Probe | Result |
|---------|-------|--------|
| Backend | `curl http://localhost:5001/` | 200 OK |
| Frontend | `curl http://localhost:5173/` | 200 |
| ML | `curl http://localhost:8000/` | Operational, model_loaded=true |

## Latest executed suite (2026-08-13 cont.)

```text
cd backend && npm test
Result: 13 passed, 0 failed
```

Idempotency probe: `201` then `200 reused=true`; distinct second booking while pending → `409`.
Customer create salon / staff → `403`. Closed salon book → `400`.


## P0 fixes implemented and re-probed

| Issue | Fix | Re-probe |
|-------|-----|----------|
| Customer could `POST /api/salons` | `requireSalonOwner` | 403 |
| Customer could manage staff | `requireSalonOwner` on staff routes | 403 |
| Customer could open owner booking APIs | role guard on salon-bookings + status patch | (route-level) |
| Booking while salon closed | reject closed/break | 400 |
| Owner email on public salon GET | populate `name` only | email absent |
| JWT fallback `'secret'` | require `JWT_SECRET` | code change |
| Auth middleware double-response risk | early returns | code change |
| Frontend customers opening `/admin/dashboard` | role-gated `ProtectedRoute` | code change |

## Known remaining P0/P1 (not fully fixed yet)

- No booking idempotency / concurrency control (triple pending bookings succeeded in probe)
- Customer dashboard has **no Socket.IO** subscription (realtime ETA for customers incomplete)
- Socket estimate events historically mismatched (`queue-update-*` vs `booking_updated`); owner path improved
- Razorpay configured → demo pay blocked (local E2E payment harder without Test Mode checkout UI)
- Email verification gates automated customer E2E without mailbox or DB force-verify
- No rate limiting
- CORS `origin: '*'` on Socket.IO
- Business hours missing
- No-show status missing
- ML metrics on live process may be stale until ML restart after retrain
- Unique `ownerId` index on Salon — safe only if one salon per owner (already enforced in create)
