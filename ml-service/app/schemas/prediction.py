from typing import Any, Optional

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    queue_length: int = Field(ge=0)
    active_barbers: int = Field(ge=1)
    service_duration_avg: float = Field(gt=0)
    time_of_day: int = Field(ge=0, le=24 * 60)  # Minutes from midnight
    day_of_week: int = Field(ge=0, le=6)  # 0=Monday, 6=Sunday
    total_chairs: int = Field(ge=1)
    queue_workload: Optional[float] = Field(
        default=None,
        description="Remaining service minutes ahead in queue (preferred over queue_length * duration)",
    )


class PredictionResponse(BaseModel):
    estimated_wait_time: float
    confidence_score: float
    method: Optional[str] = None
    physics_baseline: Optional[float] = None
    ml_raw: Optional[float] = None
    hybrid_weight: Optional[float] = None
    metrics: Optional[dict[str, Any]] = None


class TrainingData(BaseModel):
    queue_length: int
    active_barbers: int
    service_duration_avg: float
    time_of_day: int
    day_of_week: int
    total_chairs: int
    actual_wait_time: float
    queue_workload: Optional[float] = None
