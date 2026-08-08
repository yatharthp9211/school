"""Application configuration.

Secrets are read from the environment (or a .env file next to this module).
Never hardcode production secrets in source.
"""
import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env if present (python-dotenv). Pydantic-settings reads the process env.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Development-only fallback. Real deployments MUST set DEMOCRATE_SECRET_KEY.
_DEV_SECRET = "dev-only-insecure-key-do-not-use-in-production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Democrate Backend"
    API_V1_STR: str = "/api/v1"

    # JWT signing
    SECRET_KEY: str = os.getenv("DEMOCRATE_SECRET_KEY", _DEV_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("DEMOCRATE_TOKEN_TTL_MINUTES", "60"))

    # Database
    DATABASE_URL: str = os.getenv("DEMOCRATE_DATABASE_URL", "sqlite:///./democrate.db")

    # Registration gates (empty string = feature disabled)
    TEACHER_KEY: str = os.getenv("DEMOCRATE_TEACHER_KEY", "")

    # CORS — comma-separated list of allowed origins.
    # Local defaults cover the API server (5000), the static frontend served
    # from common dev ports (8080, 3000, 5500, 5173) and uvicorn's 8000.
    ALLOWED_ORIGINS: str = os.getenv(
        "DEMOCRATE_ALLOWED_ORIGINS",
        "http://localhost:5000,http://127.0.0.1:5000,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:8000,http://127.0.0.1:8000,"
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    # Moderation threshold: weighted score at/below this flags a complaint for review.
    FALSE_SCORE_THRESHOLD: int = int(os.getenv("DEMOCRATE_FALSE_THRESHOLD", "-50"))
    FALSE_BAN_COUNT: int = int(os.getenv("DEMOCRATE_FALSE_BAN_COUNT", "5"))

    # Rate limiting (in-memory; adequate for the single-process pilot.
    # Production: rely on Cloudflare edge limits / shared limiter when traffic demands it).
    AUTH_RATE_LIMIT: int = int(os.getenv("DEMOCRATE_AUTH_RATE_LIMIT", "20"))
    GENERAL_RATE_LIMIT: int = int(os.getenv("DEMOCRATE_GENERAL_RATE_LIMIT", "120"))
    RATE_WINDOW_SECONDS: int = int(os.getenv("DEMOCRATE_RATE_WINDOW", "60"))


settings = Settings()

if settings.SECRET_KEY == _DEV_SECRET:
    print("WARNING: Using the development JWT secret. Set DEMOCRATE_SECRET_KEY in production.")
