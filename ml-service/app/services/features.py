"""Shared feature engineering for wait-time train + predict."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "queue_length",
    "active_barbers",
    "avg_duration",
    "total_chairs",
    "time_of_day",
    "day_of_week",
    "load_per_barber",
    "chair_pressure",
    "queue_workload",
    "service_intensity",
    "hour_sin",
    "hour_cos",
    "is_weekend",
    "is_peak",
]


def _peak(minutes_from_midnight: float) -> int:
    # Late morning + evening rush typical for salons
    return int((11 * 60 <= minutes_from_midnight <= 14 * 60) or (17 * 60 <= minutes_from_midnight <= 20 * 60))


def engineer_row(
    *,
    queue_length: float,
    active_barbers: float,
    avg_duration: float,
    total_chairs: float,
    time_of_day: float,
    day_of_week: float,
    queue_workload: float | None = None,
) -> dict[str, float]:
    barbers = max(1.0, float(active_barbers))
    chairs = max(1.0, float(total_chairs))
    q = max(0.0, float(queue_length))
    duration = max(1.0, float(avg_duration))
    tod = float(time_of_day) % (24 * 60)
    dow = float(day_of_week) % 7
    workload = float(queue_workload) if queue_workload is not None else q * duration

    hour = tod / 60.0
    return {
        "queue_length": q,
        "active_barbers": barbers,
        "avg_duration": duration,
        "total_chairs": chairs,
        "time_of_day": tod,
        "day_of_week": dow,
        "load_per_barber": q / barbers,
        "chair_pressure": q / chairs,
        "queue_workload": max(0.0, workload),
        "service_intensity": duration / barbers,
        "hour_sin": math.sin(2 * math.pi * hour / 24.0),
        "hour_cos": math.cos(2 * math.pi * hour / 24.0),
        "is_weekend": float(dow >= 5),
        "is_peak": float(_peak(tod)),
    }


def rows_to_frame(rows: list[dict[str, Any]]) -> pd.DataFrame:
    engineered = [
        {
            **engineer_row(
                queue_length=r["queue_length"],
                active_barbers=r["active_barbers"],
                avg_duration=r.get("avg_duration", r.get("service_duration_avg", 30)),
                total_chairs=r["total_chairs"],
                time_of_day=r["time_of_day"],
                day_of_week=r["day_of_week"],
                queue_workload=r.get("queue_workload"),
            ),
            **({"actual_wait_time": r["actual_wait_time"]} if "actual_wait_time" in r else {}),
        }
        for r in rows
    ]
    return pd.DataFrame(engineered)


def naive_wait(
    queue_length: float,
    avg_duration: float,
    active_barbers: float,
    queue_workload: float | None = None,
) -> float:
    """Physics baseline: remaining work / capacity."""
    barbers = max(1.0, float(active_barbers))
    if queue_workload is not None:
        return max(0.0, float(queue_workload) / barbers)
    return max(0.0, (max(0.0, float(queue_length)) * max(1.0, float(avg_duration))) / barbers)


def feature_matrix(df: pd.DataFrame) -> np.ndarray:
    return df[FEATURE_COLUMNS].astype(float).values
