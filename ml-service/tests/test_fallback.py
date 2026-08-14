"""ML service smoke tests — physics fallback and health contract."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.predictor import WaitTimePredictor


def test_physics_fallback_without_model():
    p = WaitTimePredictor()
    p.model = None
    out = p.predict(
        {
            "queue_length": 4,
            "active_barbers": 2,
            "avg_duration": 30,
            "total_chairs": 3,
            "time_of_day": 12 * 60,
            "day_of_week": 2,
            "queue_workload": 120,
        }
    )
    assert out["predicted_wait_time"] >= 0
    assert "physics" in str(out.get("method", "")).lower() or out.get("physics_baseline") is not None


def test_invalid_input_clamped():
    p = WaitTimePredictor()
    out = p.predict(
        {
            "queue_length": -5,
            "active_barbers": 0,
            "avg_duration": -10,
            "total_chairs": 0,
            "time_of_day": 0,
            "day_of_week": 0,
            "queue_workload": 0,
        }
    )
    assert out["predicted_wait_time"] >= 0


if __name__ == "__main__":
    test_physics_fallback_without_model()
    test_invalid_input_clamped()
    print("ml smoke ok")
