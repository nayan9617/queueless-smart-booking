"""Holdout MAE must be reported separately for organic vs synthetic rows."""
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.metrics import holdout_metrics_by_origin  # noqa: E402


def test_holdout_splits_organic_and_synthetic_mae():
    y_true = np.array([10.0, 10.0, 10.0, 10.0])
    y_pred = np.array([12.0, 12.0, 20.0, 20.0])
    origins = np.array(["organic", "organic", "synthetic", "synthetic"])
    baseline = np.array([11.0, 11.0, 10.0, 10.0])

    split = holdout_metrics_by_origin(y_true, y_pred, origins, baseline)

    assert split["organic"]["n"] == 2
    assert split["synthetic"]["n"] == 2
    assert split["organic"]["mae"] == 2.0
    assert split["synthetic"]["mae"] == 10.0
    assert split["organic"]["baseline_mae"] == 1.0
    assert split["synthetic"]["baseline_mae"] == 0.0


def test_holdout_empty_origin_is_null():
    y_true = np.array([5.0, 7.0])
    y_pred = np.array([6.0, 6.0])
    origins = np.array(["organic", "organic"])

    split = holdout_metrics_by_origin(y_true, y_pred, origins)

    assert split["organic"]["mae"] == 1.0
    assert split["synthetic"]["n"] == 0
    assert split["synthetic"]["mae"] is None


if __name__ == "__main__":
    test_holdout_splits_organic_and_synthetic_mae()
    test_holdout_empty_origin_is_null()
    print("holdout metrics ok")
