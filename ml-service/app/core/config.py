from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

# Load .env from project root if it exists
# Assuming ml-service is at /ml-service and .env is at /
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(base_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # Try alternate location if running from root
    load_dotenv(".env")

class Settings(BaseSettings):
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/queueless")
    DB_NAME: str = "queueless"
    MODEL_PATH: str = "data/wait_time_model.joblib"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
