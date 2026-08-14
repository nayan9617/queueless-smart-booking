"""Load + synthesize realistic wait-time training samples from MongoDB history."""

from __future__ import annotations

from datetime import datetime, timedelta
import numpy as np
from bson import ObjectId
from pymongo import MongoClient

from app.core.config import get_settings
from app.services.features import naive_wait

settings = get_settings()


def get_db():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DB_NAME]


def _as_oid(value):
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except Exception:
        return value


def calculate_queue_snapshot(target_booking: dict, all_bookings: list[dict]) -> tuple[int, float]:
    """Return (people ahead, remaining workload minutes) at bookingTime."""
    arrival_time = target_booking.get("bookingTime")
    if not arrival_time:
        return 0, 0.0

    target_salon = _as_oid(target_booking.get("salonId"))
    people = 0
    workload = 0.0

    for b in all_bookings:
        if b.get("_id") == target_booking.get("_id"):
            continue
        if _as_oid(b.get("salonId")) != target_salon:
            continue

        b_arrival = b.get("bookingTime")
        if not b_arrival or b_arrival > arrival_time:
            continue

        b_end = b.get("actualEndTime")
        if b_end and b_end <= arrival_time:
            continue

        # Still in shop / waiting when target arrived
        people += 1
        services = b.get("services") or []
        duration = sum(float(s.get("duration") or 0) for s in services)
        if duration <= 0:
            duration = 30.0

        # If already started, only remaining service time counts
        start = b.get("actualStartTime")
        if start and start < arrival_time:
            elapsed = (arrival_time - start).total_seconds() / 60.0
            duration = max(0.0, duration - elapsed)

        workload += duration

    return people, workload


def fetch_training_data() -> list[dict]:
    db = get_db()

    bookings = list(
        db.bookings.find(
            {
                "status": "completed",
                "actualStartTime": {"$exists": True, "$ne": None},
                "bookingTime": {"$exists": True, "$ne": None},
                # Keep synthetic seed history out of the organic training set
                "dataOrigin": {"$ne": "synthetic"},
                "notes": {"$ne": "ml-history-seed"},
            }
        )
    )

    if not bookings:
        print("No completed bookings found for training.")
        return []

    salon_ids = list({_as_oid(b["salonId"]) for b in bookings if b.get("salonId")})
    salons_map = {
        s["_id"]: s
        for s in db.salons.find({"_id": {"$in": salon_ids}})
    }

    # Broad history for queue reconstruction
    min_time = min(b["bookingTime"] for b in bookings) - timedelta(hours=6)
    max_time = max(b["bookingTime"] for b in bookings) + timedelta(hours=6)
    history = list(
        db.bookings.find(
            {
                "bookingTime": {"$gte": min_time, "$lte": max_time},
            },
            {
                "bookingTime": 1,
                "actualStartTime": 1,
                "actualEndTime": 1,
                "salonId": 1,
                "services": 1,
                "status": 1,
            },
        )
    )

    print(f"Processing {len(bookings)} completed bookings for training...")
    training_data: list[dict] = []

    for b in bookings:
        booking_time = b.get("bookingTime")
        start_time = b.get("actualStartTime")
        if not booking_time or not start_time:
            continue

        wait_minutes = max(0.0, (start_time - booking_time).total_seconds() / 60.0)
        if wait_minutes > 240:
            continue

        snap = b.get("mlSnapshot") or {}
        if snap.get("queue_length") is not None:
            training_data.append(
                {
                    "queue_length": float(snap["queue_length"]),
                    "active_barbers": float(snap.get("active_barbers") or 1),
                    "avg_duration": float(snap.get("avg_duration") or 30),
                    "total_chairs": float(snap.get("total_chairs") or 1),
                    "time_of_day": float(snap.get("time_of_day") or (booking_time.hour * 60 + booking_time.minute)),
                    "day_of_week": float(snap.get("day_of_week") if snap.get("day_of_week") is not None else booking_time.weekday()),
                    "queue_workload": float(snap.get("queue_workload") or 0),
                    "actual_wait_time": wait_minutes,
                    "data_origin": "organic",
                    "predicted_wait_time": float(b.get("predictedWaitMinutes") or snap.get("predicted_wait") or 0),
                }
            )
            continue

        salon = salons_map.get(_as_oid(b.get("salonId")))
        queue_len, queue_workload = calculate_queue_snapshot(b, history)

        if salon:
            staff = salon.get("staff") or []
            active_barbers = sum(1 for s in staff if s.get("isAvailable", True))
            if active_barbers <= 0:
                active_barbers = max(1, len(staff) or 1)
            total_chairs = max(1, int(salon.get("chairs") or 1))
        else:
            active_barbers = 2
            total_chairs = 3

        total_service_duration = sum(float(s.get("duration") or 0) for s in (b.get("services") or []))
        if total_service_duration <= 0:
            total_service_duration = 30.0

        training_data.append(
            {
                "queue_length": queue_len,
                "active_barbers": active_barbers,
                "avg_duration": total_service_duration,
                "total_chairs": total_chairs,
                "time_of_day": booking_time.hour * 60 + booking_time.minute,
                "day_of_week": booking_time.weekday(),
                "queue_workload": queue_workload,
                "actual_wait_time": wait_minutes,
                "data_origin": "organic",
                "predicted_wait_time": float(b.get("predictedWaitMinutes") or 0),
            }
        )

    print(f"Generated {len(training_data)} organic training samples.")
    return training_data


def generate_synthetic_training_data(n: int = 800, seed: int = 42) -> list[dict]:
    """
    Queueing-theory grounded synthetic history so the model learns real dynamics
    even before many live completed bookings exist.
    """
    rng = np.random.default_rng(seed)
    rows: list[dict] = []

    for _ in range(n):
        active_barbers = int(rng.integers(1, 5))
        total_chairs = int(rng.integers(active_barbers, active_barbers + 4))
        queue_length = int(rng.integers(0, 12))
        avg_duration = float(rng.choice([15, 20, 25, 30, 35, 40, 45, 50, 60]))
        day_of_week = int(rng.integers(0, 7))
        # Bias samples toward open hours
        hour = int(rng.choice(list(range(9, 21))))
        minute = int(rng.integers(0, 60))
        time_of_day = hour * 60 + minute

        # Remaining work ahead ≈ people * duration with noise
        queue_workload = max(0.0, queue_length * avg_duration * float(rng.uniform(0.75, 1.25)))
        baseline = naive_wait(queue_length, avg_duration, active_barbers, queue_workload)

        # Peak / weekend inflate wait slightly
        peak_bump = 1.15 if (11 <= hour <= 14 or 17 <= hour <= 20) else 1.0
        weekend_bump = 1.1 if day_of_week >= 5 else 1.0
        chair_factor = 1.0 + max(0.0, (queue_length - total_chairs) * 0.05)

        noise = float(rng.normal(0, max(2.0, baseline * 0.12)))
        actual = max(0.0, baseline * peak_bump * weekend_bump * chair_factor + noise)

        rows.append(
            {
                "queue_length": queue_length,
                "active_barbers": active_barbers,
                "avg_duration": avg_duration,
                "total_chairs": total_chairs,
                "time_of_day": time_of_day,
                "day_of_week": day_of_week,
                "queue_workload": queue_workload,
                "actual_wait_time": round(actual, 2),
                "data_origin": "synthetic",
            }
        )

    print(f"Generated {len(rows)} synthetic queueing samples.")
    return rows
