# ML Service

FastAPI microservice for wait-time prediction.

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Scripts

- `GET /` - Health check.
- `POST /predict` - Predict wait time.
- `POST /train-init` - Trigger model training.
