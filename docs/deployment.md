# Deployment

Before deploying:

- Set production values for `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and `ML_SERVICE_URL`.
- Build the backend and frontend.
- Run the ML service with a production ASGI server.
- Ensure email credentials are valid for outbound notifications.
- Persist `backend/uploads/` (or mount object storage later) so salon photo uploads survive deploys.

## ML wait-time service (required in production)

The wait estimate USP depends on a live ML process — do not skip this in production.

```bash
cd ml-service
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
# First deploy: seed + train once (optional if you already have model artifacts)
./venv/bin/python -m app.scripts.seed_ml_history
./venv/bin/python -c "from app.services.predictor import predictor; print(predictor.train())"
# Run under a process manager (systemd, Docker, Render, Railway, etc.)
./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Point backend `ML_SERVICE_URL` at that public URL (same private network preferred).
- Ship `ml-service/data/wait_time_model.joblib` with the deploy, or call `POST /train` after Mongo has completed bookings.
- Health: `GET /` and `GET /metrics`.
- Retrain periodically (cron) as real visits complete — bookings store `mlSnapshot` for clean labels.

The backend and frontend can be deployed independently, but both should point to the same MongoDB and auth settings.
