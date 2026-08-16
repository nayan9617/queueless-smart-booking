"""Holdout error split by data origin (organic vs synthetic)."""

from __future__ import annotations

from typing import Any, Optional

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def holdout_metrics_by_origin(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    origins: np.ndarray,
    baseline: np.ndarray | None = None,
) -> dict[str, Any]:
    """Split holdout error so synthetic fill cannot mask organic MAE."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    origins = np.asarray(origins)
    baseline_arr = None if baseline is None else np.asarray(baseline, dtype=float)

    def _slice(label: str) -> dict[str, Any]:
        mask = origins == label
        n = int(mask.sum())
        if n == 0:
            return {"n": 0, "mae": None, "rmse": None, "r2": None, "baseline_mae": None}
        yt = y_true[mask]
        yp = y_pred[mask]
        r2: Optional[float] = None
        if n >= 2:
            r2 = round(float(r2_score(yt, yp)), 4)
        baseline_mae: Optional[float] = None
        if baseline_arr is not None:
            baseline_mae = round(float(mean_absolute_error(yt, baseline_arr[mask])), 3)
        return {
            "n": n,
            "mae": round(float(mean_absolute_error(yt, yp)), 3),
            "rmse": round(float(np.sqrt(mean_squared_error(yt, yp))), 3),
            "r2": r2,
            "baseline_mae": baseline_mae,
        }

    return {
        "organic": _slice("organic"),
        "synthetic": _slice("synthetic"),
    }
