"""
Seed realistic completed bookings with coherent queues + stored ML feature snapshots.

Usage:
  cd ml-service && ./venv/bin/python -m app.scripts.seed_ml_history
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from pymongo import MongoClient

from app.core.config import get_settings
from app.services.features import naive_wait

settings = get_settings()


def main(days: int = 30, bookings_per_salon_day: int = 8) -> None:
    client = MongoClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]

    # Remove prior seed rows so retrains stay clean
    deleted = db.bookings.delete_many({"notes": "ml-history-seed"})
    print(f"Cleared {deleted.deleted_count} previous ML seed bookings.")

    salons = list(db.salons.find({}))
    if not salons:
        raise SystemExit("No salons found. Run backend `npm run seed` first.")

    users = list(db.users.find({}).limit(30))
    if not users:
        user_id = db.users.insert_one(
            {
                "name": "ML Seed Customer",
                "email": f"ml-seed-{ObjectId()}@queueless.local",
                "password": "unused",
                "role": "customer",
                "isVerified": True,
                "createdAt": datetime.now(timezone.utc),
            }
        ).inserted_id
        users = [{"_id": user_id, "email": "seed@queueless.local", "name": "Seed"}]

    rng = random.Random(42)
    inserted = 0
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    for salon in salons:
        staff = salon.get("staff") or []
        active_barbers = max(
            1,
            sum(1 for s in staff if s.get("isAvailable", True)) or len(staff) or 1,
        )
        chairs = max(1, int(salon.get("chairs") or 1))
        catalog = salon.get("services") or [
            {"name": "Haircut", "price": 300, "duration": 30},
            {"name": "Beard Trim", "price": 150, "duration": 20},
            {"name": "Hair Spa", "price": 800, "duration": 45},
        ]

        for day_i in range(days):
            day_start = today - timedelta(days=day_i + 1)
            chair_free = [day_start + timedelta(hours=9) for _ in range(active_barbers)]
            open_customers: list[tuple[datetime, float]] = []

            n = max(4, bookings_per_salon_day + rng.randint(-2, 3))
            # Generate arrival times first, then simulate in chronological order
            arrivals: list[tuple[datetime, dict]] = []
            for _ in range(n):
                hour = rng.choice([9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
                minute = rng.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
                booking_time = day_start + timedelta(hours=hour, minutes=minute)
                service = rng.choice(catalog)
                arrivals.append((booking_time, service))
            arrivals.sort(key=lambda x: x[0])

            for booking_time, service in arrivals:
                duration = float(service.get("duration") or 30)
                hour = booking_time.hour
                minute = booking_time.minute

                still_here = [(end, dur) for end, dur in open_customers if end > booking_time]
                open_customers = still_here
                queue_length = len(still_here)
                queue_workload = 0.0
                for end, dur in still_here:
                    remaining = max(0.0, (end - booking_time).total_seconds() / 60.0)
                    queue_workload += min(dur, remaining)

                peak = 1.08 if hour in (11, 12, 13, 17, 18) else 1.0
                weekend = 1.05 if booking_time.weekday() >= 5 else 1.0
                next_chair = min(chair_free)
                physics_start = max(booking_time, next_chair)
                physics_wait = max(0.0, (physics_start - booking_time).total_seconds() / 60.0)
                # Labels ≈ multi-server physics + small operational noise
                wait = max(0.0, physics_wait * peak * weekend + rng.gauss(0, 1.2))

                start = booking_time + timedelta(minutes=wait)
                end = start + timedelta(minutes=duration)

                idx = chair_free.index(min(chair_free))
                chair_free[idx] = end
                open_customers.append((end, duration))

                user = rng.choice(users)
                snapshot = {
                    "queue_length": queue_length,
                    "active_barbers": active_barbers,
                    "avg_duration": duration,
                    "total_chairs": chairs,
                    "time_of_day": hour * 60 + minute,
                    "day_of_week": booking_time.weekday(),
                    "queue_workload": round(queue_workload, 2),
                }

                db.bookings.insert_one(
                    {
                        "userId": user["_id"],
                        "salonId": salon["_id"],
                        "services": [
                            {
                                "name": service.get("name", "Service"),
                                "price": float(service.get("price") or 200),
                                "duration": duration,
                                "guestName": "Seed Guest",
                            }
                        ],
                        "totalAmount": float(service.get("price") or 200),
                        "paymentStatus": "paid",
                        "paymentMethod": "demo",
                        "contactInfo": {
                            "phone": "9999999999",
                            "email": user.get("email", "seed@queueless.local"),
                            "name": user.get("name", "Seed"),
                        },
                        "notes": "ml-history-seed",
                        "dataOrigin": "synthetic",
                        "status": "completed",
                        "bookingTime": booking_time,
                        "estimatedWaitTime": round(wait, 1),
                        "actualStartTime": start,
                        "actualEndTime": end,
                        "mlSnapshot": snapshot,
                        "isRated": False,
                        "createdAt": booking_time,
                        "updatedAt": end,
                    }
                )
                inserted += 1

    print(f"Inserted {inserted} coherent completed bookings across {len(salons)} salons.")
    print("Next: POST http://localhost:8000/train  (or restart the ML service)")


if __name__ == "__main__":
    main()
