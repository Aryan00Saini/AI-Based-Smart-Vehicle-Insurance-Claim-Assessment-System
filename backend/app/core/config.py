import os
from decimal import Decimal
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-Based Smart Vehicle Insurance Claim Assessment System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Persistence
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'claims.db'}")
    
    # JWT Security
    # Loaded from the SECRET_KEY environment variable (see .env.example).
    # The fallback below is for local development ONLY — never rely on it
    # in any deployed or publicly reachable environment.
    SECRET_KEY: str = "dev-only-insecure-default-do-not-use-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Object Storage
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local") # "local" or "s3"
    LOCAL_STORAGE_DIR: str = str(BASE_DIR / "data" / "storage")
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "vehicle-claims")
    S3_REGION_NAME: str = os.getenv("S3_REGION_NAME", "us-east-1")
    
    # Business Rules & Decision Thresholds
    AUTO_APPROVE_CEILING: Decimal = Decimal("25000.00")
    MODEL_CONFIDENCE_THRESHOLD: float = 0.80
    BLUR_LAPLACIAN_THRESHOLD: float = 100.0
    DUPLICATE_HASH_HAMMING_THRESHOLD: int = 5
    MIN_VEHICLE_COVERAGE_RATIO: float = 0.08
    MAX_DISTINCT_PARTS_FOR_AUTO_APPROVE: int = 2

    # Whitelist for damage types permitted for AUTO_APPROVED
    COSMETIC_DAMAGE_WHITELIST: tuple = ("scratch", "dent", "paint_chip")
    ALLOWED_SEVERITY_BANDS: tuple = ("MINOR", "MODERATE")

    # Upload limits (server-side enforcement, matches frontend's stated "up to 10MB")
    MAX_UPLOAD_FILE_SIZE_MB: int = 10
    ALLOWED_UPLOAD_CONTENT_TYPES: tuple = ("image/jpeg", "image/png", "image/webp")

    # CORS: comma-separated list of allowed frontend origins in production,
    # e.g. "https://your-app.vercel.app". Defaults to "*" for local dev.
    CORS_ALLOWED_ORIGINS: str = os.getenv("CORS_ALLOWED_ORIGINS", "*")

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
