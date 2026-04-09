from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.predictor import predictor

app = FastAPI(title="QueueLess ML Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ML Service Operational"}

@app.post("/predict", response_model=PredictionResponse)
def predict_wait_time(request: PredictionRequest):
    try:
        if request.active_barbers <= 0:
            raise HTTPException(status_code=400, detail="Active barbers must be > 0")

        estimated_time = predictor.predict(
            queue_length=request.queue_length,
            active_barbers=request.active_barbers,
            avg_duration=request.service_duration_avg,
            total_chairs=request.total_chairs,
            time_of_day=request.time_of_day,
            day_of_week=request.day_of_week
        )
        
        return {
            "estimated_wait_time": max(0, estimated_time),
            "confidence_score": 0.85 if predictor.model else 0.5
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train-init")
def train_init_model():
    """Endpoint to trigger initial model training (Real or Dummy)"""
    try:
        predictor.train_model()
        return {"message": "Model training complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
