from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.predictor import predictor


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Boot with a real model so predictions are never dummy-hardcoded
    if predictor.model is None:
        try:
            print("No model on disk — training hybrid wait-time model...")
            predictor.train(use_synthetic_if_scarce=True)
        except Exception as exc:
            print(f"Startup train skipped: {exc}")
    yield


app = FastAPI(
    title="QueueLess ML Microservice",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "ML Service Operational",
        "model_loaded": predictor.model is not None,
        "metrics": predictor.metrics,
    }


@app.get("/health")
def health():
    loaded = predictor.model is not None
    return {
        "ok": True,
        "service": "queueless-ml",
        "model_loaded": loaded,
        "model_usable": loaded or True,  # physics baseline always usable via hybrid predict
        "n_train": getattr(predictor, "n_train", 0),
        "metrics": predictor.metrics,
    }


@app.post("/reload")
def reload_model():
    """Reload model artifact from disk after external train/restart."""
    try:
        predictor.load_model()
        return {
            "message": "Model reload attempted",
            "model_loaded": predictor.model is not None,
            "metrics": predictor.metrics,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/metrics")
def get_metrics():
    if not predictor.metrics:
        raise HTTPException(status_code=404, detail="No training metrics yet. POST /train first.")
    return predictor.metrics


@app.post("/predict", response_model=PredictionResponse)
def predict_wait_time(request: PredictionRequest):
    try:
        result = predictor.predict(
            {
                "queue_length": request.queue_length,
                "active_barbers": request.active_barbers,
                "avg_duration": request.service_duration_avg,
                "total_chairs": request.total_chairs,
                "time_of_day": request.time_of_day,
                "day_of_week": request.day_of_week,
                "queue_workload": request.queue_workload,
            }
        )
        return {
            "estimated_wait_time": max(0.0, float(result["predicted_wait_time"])),
            "confidence_score": float(result["confidence_score"]),
            "method": result.get("method"),
            "physics_baseline": result.get("physics_baseline"),
            "ml_raw": result.get("ml_raw"),
            "hybrid_weight": result.get("hybrid_weight"),
            "metrics": result.get("metrics"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/train")
@app.post("/train-init")
def train_model():
    """Retrain on Mongo completed bookings + physics-grounded synthetic fill."""
    try:
        metrics = predictor.train(use_synthetic_if_scarce=True)
        predictor.load_model()  # ensure in-memory matches disk
        return {"message": "Model training complete", "metrics": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
