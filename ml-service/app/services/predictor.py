"""Wait-time model: gradient boosting + physics hybrid + real confidence."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from app.core.config import get_settings
from app.services.data_loader import fetch_training_data, generate_synthetic_training_data
from app.services.features import FEATURE_COLUMNS, engineer_row, feature_matrix, naive_wait, rows_to_frame

settings = get_settings()
MODEL_PATH = settings.MODEL_PATH
METRICS_PATH = os.path.join(os.path.dirname(MODEL_PATH) or ".", "model_metrics.json")


@dataclass
class TrainMetrics:
    n_samples: int
    n_real: int
    n_synthetic: int
    mae: float
    rmse: float
    r2: float
    baseline_mae: float
    improvement_vs_baseline_pct: float
    trained_at: str
    model_type: str


class WaitTimePredictor:
    def __init__(self) -> None:
        self.model: HistGradientBoostingRegressor | None = None
        self.metrics: dict[str, Any] | None = None
        self.residual_mae: float = 8.0
        self.n_train: int = 0
        self._ensure_model_dir()
        self.load_model()

    def _ensure_model_dir(self) -> None:
        directory = os.path.dirname(MODEL_PATH)
        if directory:
            os.makedirs(directory, exist_ok=True)

    def train(self, use_synthetic_if_scarce: bool = True) -> dict[str, Any]:
        real = fetch_training_data()
        synthetic: list[dict] = []

        # Always mix some physics-grounded synth so sparse live data doesn't collapse the model
        if use_synthetic_if_scarce:
            need = max(0, 600 - len(real))
            synthetic = generate_synthetic_training_data(n=max(need, 200 if real else 800))

        rows = real + synthetic
        if len(rows) < 30:
            raise RuntimeError("Not enough training samples to fit a wait-time model.")

        df = rows_to_frame(rows)
        X = feature_matrix(df)
        y = df["actual_wait_time"].astype(float).values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        model = HistGradientBoostingRegressor(
            max_depth=6,
            learning_rate=0.06,
            max_iter=300,
            min_samples_leaf=8,
            l2_regularization=0.1,
            early_stopping=True,
            validation_fraction=0.12,
            n_iter_no_change=20,
            random_state=42,
        )
        model.fit(X_train, y_train)

        preds = model.predict(X_test)
        mae = float(mean_absolute_error(y_test, preds))
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
        r2 = float(r2_score(y_test, preds))

        baseline_preds = np.array(
            [
                naive_wait(
                    float(row[FEATURE_COLUMNS.index("queue_length")]),
                    float(row[FEATURE_COLUMNS.index("avg_duration")]),
                    float(row[FEATURE_COLUMNS.index("active_barbers")]),
                    float(row[FEATURE_COLUMNS.index("queue_workload")]),
                )
                for row in X_test
            ]
        )
        baseline_mae = float(mean_absolute_error(y_test, baseline_preds))
        improvement = 0.0 if baseline_mae <= 1e-6 else float((baseline_mae - mae) / baseline_mae * 100.0)

        metrics = TrainMetrics(
            n_samples=len(rows),
            n_real=len(real),
            n_synthetic=len(synthetic),
            mae=round(mae, 3),
            rmse=round(rmse, 3),
            r2=round(r2, 4),
            baseline_mae=round(baseline_mae, 3),
            improvement_vs_baseline_pct=round(improvement, 2),
            trained_at=datetime.now(timezone.utc).isoformat(),
            model_type="HistGradientBoostingRegressor+hybrid",
        )

        self.model = model
        self.metrics = asdict(metrics)
        self.residual_mae = max(1.5, mae)
        self.n_train = len(rows)

        payload = {
            "model": model,
            "metrics": self.metrics,
            "residual_mae": self.residual_mae,
            "n_train": self.n_train,
            "feature_columns": FEATURE_COLUMNS,
        }
        joblib.dump(payload, MODEL_PATH)
        with open(METRICS_PATH, "w", encoding="utf-8") as f:
            json.dump(self.metrics, f, indent=2)

        print(
            f"Model trained on {len(rows)} samples "
            f"(real={len(real)}, synth={len(synthetic)}) | "
            f"MAE={mae:.2f} vs baseline {baseline_mae:.2f} | R²={r2:.3f}"
        )
        return self.metrics

    def load_model(self) -> None:
        if not os.path.exists(MODEL_PATH):
            print("No saved model found. Call /train first.")
            return
        try:
            payload = joblib.load(MODEL_PATH)
            if isinstance(payload, dict) and "model" in payload:
                self.model = payload["model"]
                self.metrics = payload.get("metrics")
                self.residual_mae = float(payload.get("residual_mae") or 8.0)
                self.n_train = int(payload.get("n_train") or 0)
            else:
                # Legacy bare estimator
                self.model = payload
                self.metrics = None
                self.residual_mae = 8.0
                self.n_train = 0
            print(f"Model loaded from {MODEL_PATH}")
        except Exception as exc:
            print(f"Failed to load model: {exc}")
            self.model = None

    def _hybrid_weight(self) -> float:
        """More real history → trust ML more; scarce data → lean on physics."""
        n_real = int((self.metrics or {}).get("n_real") or 0)
        if n_real >= 200:
            return 0.88
        if n_real >= 80:
            return 0.75
        if n_real >= 30:
            return 0.6
        if self.n_train >= 400:
            return 0.55
        return 0.4

    def _confidence(
        self,
        pred: float,
        naive: float,
        features: dict[str, float],
    ) -> float:
        """Real confidence from residual scale, agreement with physics, and data volume."""
        mae = max(1.5, self.residual_mae)
        # Narrow relative error band → higher confidence
        denom = max(abs(pred), 5.0)
        residual_score = float(np.exp(-mae / denom))

        agree = float(np.exp(-abs(pred - naive) / max(denom, 1.0)))
        n_real = int((self.metrics or {}).get("n_real") or 0)
        data_score = min(1.0, (n_real / 120.0) * 0.55 + (self.n_train / 800.0) * 0.45)

        # Mild penalty if extreme queue (extrapolation)
        q = features["queue_length"]
        extrap = 0.85 if q > 15 else 1.0

        conf = (0.45 * residual_score + 0.35 * agree + 0.2 * data_score) * extrap
        return float(np.clip(conf, 0.35, 0.97))

    def predict(self, data: dict[str, Any]) -> dict[str, Any]:
        features = engineer_row(
            queue_length=data.get("queue_length", 0),
            active_barbers=data.get("active_barbers", 1),
            avg_duration=data.get("avg_duration", data.get("service_duration_avg", 30)),
            total_chairs=data.get("total_chairs", 1),
            time_of_day=data.get("time_of_day", 0),
            day_of_week=data.get("day_of_week", 0),
            queue_workload=data.get("queue_workload"),
        )

        naive = naive_wait(
            features["queue_length"],
            features["avg_duration"],
            features["active_barbers"],
            features["queue_workload"],
        )

        if self.model is None:
            return {
                "predicted_wait_time": round(naive, 2),
                "confidence_score": 0.45,
                "method": "physics_baseline",
                "metrics": self.metrics,
            }

        # Empty shop → essentially no wait (guard against bad historical labels)
        if features["queue_length"] <= 0 and features["queue_workload"] <= 0:
            return {
                "predicted_wait_time": 0.0,
                "confidence_score": 0.92,
                "method": "empty_queue",
                "physics_baseline": 0.0,
                "ml_raw": 0.0,
                "hybrid_weight": 1.0,
                "metrics": self.metrics,
            }

        X = np.array([[features[c] for c in FEATURE_COLUMNS]], dtype=float)
        ml_pred = float(self.model.predict(X)[0])
        w = self._hybrid_weight()
        blended = w * ml_pred + (1.0 - w) * naive
        blended = max(0.0, blended)

        return {
            "predicted_wait_time": round(blended, 2),
            "confidence_score": round(self._confidence(blended, naive, features), 3),
            "method": "hybrid_hgb",
            "ml_raw": round(ml_pred, 2),
            "physics_baseline": round(naive, 2),
            "hybrid_weight": round(w, 3),
            "metrics": self.metrics,
        }


predictor = WaitTimePredictor()
