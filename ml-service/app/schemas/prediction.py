from pydantic import BaseModel
from typing import Optional

class PredictionRequest(BaseModel):
    queue_length: int
    active_barbers: int
    service_duration_avg: float
    time_of_day: int  # Minutes from midnight
    day_of_week: int  # 0=Monday, 6=Sunday
    total_chairs: int

class PredictionResponse(BaseModel):
    estimated_wait_time: float
    confidence_score: float

class TrainingData(BaseModel):
    queue_length: int
    active_barbers: int
    service_duration_avg: float
    time_of_day: int
    day_of_week: int
    total_chairs: int
    actual_wait_time: float
