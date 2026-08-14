# QueueLess ML wait-time service

## Run

```bash
cd ml-service
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Uses root `.env` for `MONGO_URI` / `DB_NAME`. On startup, loads `data/wait_time_model.joblib` or trains automatically.

## Train / metrics

```bash
# Optional: coherent historical completed bookings
./venv/bin/python -m app.scripts.seed_ml_history

curl -X POST http://localhost:8000/train
curl http://localhost:8000/metrics
```

## What it does

- **HistGradientBoosting** on engineered queue features (load, peak hours, cyclical time, workload).
- **Hybrid** with multi-server physics baseline; weight shifts toward ML as real completed bookings grow.
- **Confidence** from holdout MAE, physics agreement, and data volume (not a hardcoded 0.85).
- Bookings store `mlSnapshot` at create time so live completions retrain cleanly.
