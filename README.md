# QueueLess

QueueLess is a salon booking platform that shows customers an estimated wait, lets them book and pay without standing in a physical queue, and gives salon owners a live chair board.

**Status: controlled private beta.** The stack is ready for a small invited group on Razorpay Test Mode. It is not a public live-money launch. Wait estimates are advisory; ML accuracy on real salons is not established yet.

## What it does

**Customers**

- Discover salons (search, nearby, wait estimate)
- Book a service, pay with Razorpay Test Mode, and track queue position / ETA live
- Cancel while waiting, then rate after completion

**Owners**

- One salon per owner: services, staff, photos, open / closed / break
- Start, complete, and mark no-show on the live queue
- Today analytics (bookings, no-shows, revenue)

**Platform**

- JWT auth (email + Google), email verification
- Socket.IO (JWT handshake) for live queue updates
- Unpaid holds expire automatically (`PENDING_BOOKING_TTL_MINUTES`)
- Atomic chair capacity (concurrent Start cannot over-book chairs)
- Hybrid wait-time service (physics baseline + ML; organic bookings only for training)

## Architecture

```
React (Vite)  ──HTTP + Socket.IO──►  Express API  ──►  MongoDB
                                      │
                                      └──►  FastAPI ML service
```

| Path | Role | Default |
|------|------|---------|
| `frontend/` | Customer + owner UI | `http://localhost:5173` |
| `backend/` | Auth, bookings, payments, sockets, ops | `http://localhost:5001` |
| `ml-service/` | Wait-time predict / train | `http://localhost:8000` |

Backend reads the **repo-root** `.env`. Frontend Vite vars live in `frontend/.env`.

## Requirements

- Node.js 18+
- Python 3.11+
- MongoDB (local or hosted)
- Razorpay **Test Mode** keys for real checkout (`rzp_test_…`)

## Quick start

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
# Edit .env: MONGO_URI, JWT_SECRET, email, Razorpay test keys
# Edit frontend/.env: VITE_GOOGLE_CLIENT_ID if using Google sign-in
```

```bash
# terminal 1 — API
cd backend && npm install && npm run dev

# terminal 2 — UI
cd frontend && npm install && npm run dev

# terminal 3 — wait-time service
cd ml-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Optional sample data:

```bash
cd backend
npm run seed        # demo Jodhpur salons
npm run seed:beta   # two beta salons (change passwords before sharing)
```

Health:

- API: `GET http://localhost:5001/health` → `{ ok, services: { api, mongo, ml } }`
- ML: `GET http://localhost:8000/health`

## Environment

Copy from [`.env.example`](./.env.example). Full notes: [`docs/environment.md`](./docs/environment.md).

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `local` \| `beta` \| `production`. In `beta`/`production`, dangerous flags are ignored even if set true. |
| `MONGO_URI` / `DB_NAME` | Mongo connection |
| `JWT_SECRET` | Must be unique; never leave `change-me` in beta |
| `CLIENT_URL` | Frontend origin (emails, CORS) |
| `EMAIL_USER` / `EMAIL_PASS` | Transactional email (Gmail app password) |
| `ML_SERVICE_URL` | Wait-time service; physics fallback if down |
| `GOOGLE_CLIENT_ID` | Backend Google token verify |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Test Mode only for beta |
| `PENDING_BOOKING_TTL_MINUTES` | Unpaid booking auto-cancel (default 20) |
| `BETA_OPS_SECRET` | `GET /api/ops/beta-stats` via header `x-beta-ops-key` |

Frontend (`frontend/.env`):

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base; default `http://localhost:5001/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google button (same Web client ID as backend) |

**Local / E2E only — never true for real testers:** `ALLOW_DEMO_PAY`, `ALLOW_TEST_EMAIL_VERIFY`, `DISABLE_RATE_LIMIT`.

## Scripts

**Backend** (`backend/`)

| Script | What it does |
|--------|----------------|
| `npm run dev` | API in watch mode |
| `npm run build` / `npm start` | Compile and run `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Node test runner (`src/**/*.test.ts`) |
| `npm run seed` / `npm run seed:beta` | Sample / beta salons |

**Frontend** (`frontend/`)

| Script | What it does |
|--------|----------------|
| `npm run dev` | Vite |
| `npm run build` | Production bundle |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (needs API + UI + flags for local E2E) |

## API surface

Auth on all booking/staff/owner salon writes. Role guards: customers cannot create salons or run the owner queue.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/health` | API + Mongo + ML |
| `GET` | `/api/ops/health` | Same payload |
| `GET` | `/api/ops/beta-stats` | Founder snapshot; `x-beta-ops-key` |
| `POST` | `/api/auth/register` · `/login` · `/google` | Rate limited |
| `GET`/`POST` | `/api/auth/verify-email` | |
| `GET` | `/api/salons` · `/api/salons/:id` | Public; owner email not exposed |
| `GET` | `/api/salons/:id/wait-estimate` | Advisory ETA |
| `POST` | `/api/bookings` | Idempotent via `clientRequestId` |
| `POST` | `/api/bookings/verify-payment` | Razorpay HMAC; backend-authoritative |
| `GET` | `/api/bookings/my-bookings` | Paginated |
| `GET` | `/api/bookings/salon-bookings` · `/salon-analytics` | Owner |
| `PATCH` | `/api/bookings/:id` | Owner: start / complete / no-show |
| `POST` | `/api/bookings/:id/cancel` | |

ML: `GET /health`, `POST /predict`, `POST /train`, `GET /metrics`.

Details: [`docs/api-reference.md`](./docs/api-reference.md).

## Testing

```bash
cd backend && npm test
cd frontend && npm run test:e2e
```

Backend coverage includes queue math, chair concurrency, Razorpay HMAC, pending expiry, socket JWT, and env-flag safety. Playwright covers the customer journey, dual-browser realtime, and mobile overflow.

Local E2E may set `ALLOW_DEMO_PAY` and `ALLOW_TEST_EMAIL_VERIFY`. Those flags are ignored when `APP_ENV` is `beta` or `production`.

## Deploy / beta

Private beta checklist, monitoring, and launch gate: [`docs/beta-playbook.md`](./docs/beta-playbook.md).

Hard requirements for a shared environment:

- `APP_ENV=beta` (or `NODE_ENV=production`)
- Unique `JWT_SECRET`, working email, Razorpay **Test Mode** only
- Single API instance (rate limits and beta counters are in-memory)
- Persistent volume for `backend/uploads/`
- Live ML process; point `ML_SERVICE_URL` at it

Do not take live Razorpay keys until the playbook launch gate is met.

## Known limits

- No Razorpay **webhook** — if the customer pays then closes the modal before verify, the booking can stay pending
- No weekly business hours — owners toggle open / closed / break
- One salon per owner
- In-memory rate limits (not multi-instance)
- ETA is an estimate, not a promise
- Holdout ML metrics include synthetic history; do not advertise accuracy

## Docs

| Doc | Contents |
|-----|----------|
| [`docs/setup.md`](./docs/setup.md) | Setup |
| [`docs/environment.md`](./docs/environment.md) | Env vars, indexes, rate limits |
| [`docs/architecture.md`](./docs/architecture.md) | Service split |
| [`docs/api-reference.md`](./docs/api-reference.md) | HTTP API |
| [`docs/deployment.md`](./docs/deployment.md) | Deploy notes |
| [`docs/troubleshooting.md`](./docs/troubleshooting.md) | Common failures |
| [`docs/beta-playbook.md`](./docs/beta-playbook.md) | Private beta operations |
| [`docs/beta-incident-log.md`](./docs/beta-incident-log.md) | Incident template |
| [`docs/production-readiness-phase3.md`](./docs/production-readiness-phase3.md) | Latest evidence-based readiness report |
