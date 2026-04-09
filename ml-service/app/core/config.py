from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

base_dir = Path(__file__).resolve().parents[3]
env_path = base_dir / ".env"

if env_path.exists():
    load_dotenv(env_path)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MONGO_URI: str = "mongodb://localhost:27017/queueless"
    DB_NAME: str = "queueless"
    MODEL_PATH: str = "data/wait_time_model.joblib"

@lru_cache()
def get_settings():
    return Settings()
