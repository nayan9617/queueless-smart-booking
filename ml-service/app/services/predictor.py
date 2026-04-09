import joblib
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from app.services.data_loader import fetch_training_data
from app.core.config import get_settings

settings = get_settings()
MODEL_PATH = settings.MODEL_PATH

class WaitTimePredictor:
    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                print("Model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.model = None
        else:
            print("No model found. Using fallback heuristic.")
            self.model = None

    def predict(self, queue_length: int, active_barbers: int, avg_duration: float, 
                total_chairs: int, time_of_day: int, day_of_week: int) -> float:
        if self.model:
            # Prepare features for model: 
            # [queue_length, active_barbers, avg_duration, total_chairs, time_of_day, day_of_week]
            features = np.array([[
                queue_length, 
                active_barbers, 
                avg_duration,
                total_chairs,
                time_of_day,
                day_of_week
            ]])
            return float(self.model.predict(features)[0])
        
        # Fallback Heuristic
        effective_capacity = max(1, active_barbers)
        # Maybe use total_chairs as a factor if active_barbers is missing, but here we have it.
        
        base_wait = (queue_length * avg_duration) / effective_capacity
        return round(base_wait, 2)

    def train_model(self):
        """Trains the Linear Regression model on real data from MongoDB."""
        print("Fetching training data...")
        data = fetch_training_data()
        
        if not data:
            print("No real training data available. Falling back to dummy training.")
            self.train_dummy_model()
            return

        df = pd.DataFrame(data)
        
        X = df[[
            'queue_length', 
            'active_barbers', 
            'avg_duration', 
            'total_chairs',
            'time_of_day',
            'day_of_week'
        ]].values
        
        y = df['actual_wait_time'].values

        model = LinearRegression()
        model.fit(X, y)
        
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(model, MODEL_PATH)
        print(f"Model trained on {len(data)} records and saved.")
        self.model = model

    def train_dummy_model(self):
        """Trains a simple Linear Regression model on synthetic data to ensure file exists."""
        # Synthetic Data with new features
        # [queue, barbers, duration, chairs, time, day]
        X = np.array([
            [1, 1, 30, 5, 600, 0], 
            [2, 1, 30, 5, 630, 0], 
            [2, 2, 30, 8, 700, 1], 
            [5, 2, 20, 8, 720, 1], 
            [3, 3, 25, 10, 800, 2], 
            [0, 1, 30, 3, 500, 3]
        ])
        # y = Wait time
        y = np.array([30, 60, 30, 50, 25, 0])

        model = LinearRegression()
        model.fit(X, y)
        
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(model, MODEL_PATH)
        print("Dummy model trained and saved.")
        self.model = model

predictor = WaitTimePredictor()
