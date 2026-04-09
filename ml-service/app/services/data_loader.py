import os
from datetime import datetime
import pandas as pd
import numpy as np
from pymongo import MongoClient
from app.core.config import get_settings

settings = get_settings()

def get_db():
    client = MongoClient(settings.MONGO_URI)
    return client[settings.DB_NAME]

def calculate_queue_length(target_booking, all_bookings):
    """
    Calculate queue length at the time of target_booking.
    Queue length = number of bookings that were 'active' (created but not finished) 
    at the time of target_booking creation.
    """
    arrival_time = target_booking.get('bookingTime')
    if not arrival_time:
        return 0
        
    count = 0
    for b in all_bookings:
        if b['_id'] == target_booking['_id']:
            continue
            
        # Booking must be for same salon
        if b.get('salonId') != target_booking.get('salonId'):
            continue
            
        b_arrival = b.get('bookingTime')
        b_end = b.get('actualEndTime') or b.get('estimatedEndTime') # Fallback if not completed
        
        # If booking arrived before target and finished after target arrived (or hasn't finished)
        if b_arrival and b_arrival <= arrival_time:
            if not b_end or b_end > arrival_time:
                count += 1
    return count

def fetch_training_data():
    db = get_db()
    
    # fetch completed bookings with relevant fields
    # We need actualStartTime to calculate wait time (target)
    bookings_cursor = db.bookings.find({
        "status": "completed",
        "actualStartTime": {"$exists": True},
        "bookingTime": {"$exists": True}
    })
    
    bookings = list(bookings_cursor)
    
    if not bookings:
        print("No completed bookings found for training.")
        return []

    # Pre-fetch salons to get chairs and staff info
    salon_ids = set(b['salonId'] for b in bookings if 'salonId' in b)
    salons_cursor = db.salons.find({"_id": {"$in": list(salon_ids)}})
    salons_map = {s['_id']: s for s in salons_cursor}
    
    training_data = []
    
    # We might need all bookings to calculate queue length history correctly
    # Optimally, we would query differently, but for simpler logic we iterate.
    # To avoid O(N^2) with all bookings, we can filter relevant history.
    # For MVP, we'll try to estimate or do a limited lookback if needed.
    # But since we are offline training, we can afford some compute or optimize later.
    # Let's perform a simpler queue calculation:
    # For each booking, we count how many UNFINISHED bookings existed at its creation time.
    
    # Re-fetch all bookings for queue calculation (not just completed)
    # This might be heavy if database is huge. 
    # Optimization: Only fetch bookings that overlap with our training set time range.
    # For now, simplistic approach:
    all_active_bookings = list(db.bookings.find(
        {"bookingTime": {"$exists": True}},
        {"bookingTime": 1, "actualEndTime": 1, "salonId": 1, "estimatedEndTime": 1}
    ))

    print(f"Processing {len(bookings)} completed bookings for training...")

    # Sort all bookings by time for faster queue calc (could use bisect or sliding window)
    # But native python loop might be fast enough for thousands of records.
    
    for b in bookings:
        salon = salons_map.get(b.get('salonId'))
        if not salon:
            continue
            
        booking_time = b.get('bookingTime')
        start_time = b.get('actualStartTime')
        
        if not booking_time or not start_time:
            continue
            
        # Target: Wait Time (minutes)
        wait_time_seconds = (start_time - booking_time).total_seconds()
        wait_time_minutes = max(0, wait_time_seconds / 60)
        
        # Feature: Queue Length
        queue_len = calculate_queue_length(b, all_active_bookings)
        
        # Feature: Active Barbers (Approximation from Salon staff count)
        # Ideally we'd look at staff shifts, but we'll use total staff for now.
        active_barbers = len(salon.get('staff', []))
        if active_barbers == 0:
            active_barbers = 1 # Fallback
            
        # Feature: Avg Service Duration for this booking
        # Sum of services in this booking
        total_service_duration = sum(s.get('duration', 0) for s in b.get('services', []))
        
        # Feature: Total Chairs
        total_chairs = salon.get('chairs', 1)
        
        # Feature: Time of Day (minutes from midnight)
        time_of_day = booking_time.hour * 60 + booking_time.minute
        
        # Feature: Day of Week (0=Monday, 6=Sunday)
        day_of_week = booking_time.weekday()
        
        training_data.append({
            "queue_length": queue_len,
            "active_barbers": active_barbers,
            "avg_duration": total_service_duration,
            "total_chairs": total_chairs,
            "time_of_day": time_of_day,
            "day_of_week": day_of_week,
            "actual_wait_time": wait_time_minutes
        })
        
    print(f"Generated {len(training_data)} training samples.")
    return training_data
