# Deployment

QueueLess is three services. On Vercel they are three projects sharing one GitHub repo, each with a different root directory.

| Project | Root | Framework |
|---------|------|-----------|
| `queueless-web` | `frontend/` | Vite |
| `queueless-api` | `backend/` | Express |
| `queueless-ml` | `ml-service/` | FastAPI |

## Vercel (private beta)

1. MongoDB Atlas: allow access from anywhere (`0.0.0.0/0`) or Vercel cannot reach the database.
2. Deploy **API** first, then **ML**, then **web** (`VITE_API_URL` is baked in at build time).
3. Set `APP_ENV=beta`. Demo-pay / test-verify / disable-rate-limit are ignored.
4. Use Razorpay **Test Mode** keys only (`rzp_test_…`).
5. After you have the three `*.vercel.app` URLs:
   - API: `CLIENT_URL` = web origin, `ML_SERVICE_URL` = ML origin, `CORS_ORIGINS` if you add extra hosts
   - Web: `VITE_API_URL=https://<api-host>/api`
   - Redeploy web after changing `VITE_*`

Pending unpaid bookings expire on each create plus hourly cron (`/api/ops/expire-pending`, `CRON_SECRET`).

**Known Vercel limits for this stack**

- `backend/uploads/` is ephemeral — salon photos will not survive deploys. Use URLs or add Blob later.
- Rate-limit and beta counters are in-memory per function instance.
- Socket.IO live updates are best-effort; Mongo state is the source of truth (refresh).
- ML must ship `ml-service/data/wait_time_model.joblib` — it does not train on cold start.

## Environment (API)

Same as [`.env.example`](../.env.example), plus:

- `CORS_ORIGINS` — extra comma-separated frontend origins
- `CRON_SECRET` — Vercel Cron bearer token for `/api/ops/expire-pending`

## ML wait-time service

The wait estimate USP depends on a live ML process — do not skip this in a real-user beta.

Local / VM:

```bash
cd ml-service
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Point backend `ML_SERVICE_URL` at that public URL.
- Health: `GET /health` and `GET /metrics`.
- Retrain periodically as real visits complete — bookings store `mlSnapshot` for clean labels.

The backend and frontend can be deployed independently, but both should point to the same MongoDB and auth settings.
