"""Application configuration.

Secrets are read from the environment (or a .env file next to this module).
Never hardcode production secrets in source.
"""
import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env if present (python-dotenv). Pydantic-settings reads the process env.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

# Development-only fallback. Real deployments MUST set DEMOCRATE_SECRET_KEY.
_DEV_SECRET = "dev-only-insecure-key-do-not-use-in-production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Democrate Backend"
    API_V1_STR: str = "/api/v1"

    # JWT signing
    SECRET_KEY: str = os.getenv("DEMOCRATE_SECRET_KEY", _DEV_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("DEMOCRATE_TOKEN_TTL_MINUTES", "60"))

    # Database — default path anchored to this module's directory so the app
    # finds its DB regardless of the working directory uvicorn is launched from.
    DATABASE_URL: str = os.getenv(
        "DEMOCRATE_DATABASE_URL",
        f"sqlite:///{os.path.join(_BASE_DIR, 'democrate.db').replace(os.sep, '/')}",
    )

    # Registration gates (empty string = feature disabled)
    TEACHER_KEY: str = os.getenv("DEMOCRATE_TEACHER_KEY", "")

    # CORS — comma-separated list of allowed origins.
    # Local defaults cover the API server (5000), the static frontend served
    # from common dev ports (8080, 3000, 5500, 5173), uvicorn's 8000, and the
    # public Cloudflare tunnel domain (same-origin in production, but listed so
    # a cross-origin client — e.g. a separate SPA host — isn't silently blocked).
    ALLOWED_ORIGINS: str = os.getenv(
        "DEMOCRATE_ALLOWED_ORIGINS",
        "http://localhost:5000,http://127.0.0.1:5000,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:8000,http://127.0.0.1:8000,"
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://yatharthpandey.dpdns.org,http://yatharthpandey.dpdns.org",
    )

    # Moderation threshold: weighted score at/below this flags a complaint for review.
    FALSE_SCORE_THRESHOLD: int = int(os.getenv("DEMOCRATE_FALSE_THRESHOLD", "-50"))
    FALSE_BAN_COUNT: int = int(os.getenv("DEMOCRATE_FALSE_BAN_COUNT", "5"))

    # Rate limiting (in-memory; adequate for the single-process pilot.
    # Production: rely on Cloudflare edge limits / shared limiter when traffic demands it).
    AUTH_RATE_LIMIT: int = int(os.getenv("DEMOCRATE_AUTH_RATE_LIMIT", "200"))
    GENERAL_RATE_LIMIT: int = int(os.getenv("DEMOCRATE_GENERAL_RATE_LIMIT", "1200"))
    RATE_WINDOW_SECONDS: int = int(os.getenv("DEMOCRATE_RATE_WINDOW", "60"))

    # Developer unlock secret
    DEVELOPER_SECRET_FILE_CONTENT: str = os.getenv("DEMOCRATE_DEVELOPER_SECRET_FILE", "")


settings = Settings()

if settings.SECRET_KEY == _DEV_SECRET:
    # The dev key is public (it's in source) — anyone could forge admin JWTs.
    # Refuse to start unless a developer explicitly opts in for local work.
    allow_dev = os.getenv("DEMOCRATE_ALLOW_DEV_SECRET", "").strip().lower() in ("1", "true", "yes")
    if not allow_dev:
        raise RuntimeError(
            "Refusing to start: DEMOCRATE_SECRET_KEY is not set, so the insecure "
            "development key would be used. Set DEMOCRATE_SECRET_KEY to a long random "
            "string (see .env.example), or set DEMOCRATE_ALLOW_DEV_SECRET=1 for local "
            "development only."
        )
    print("WARNING: DEMOCRATE_ALLOW_DEV_SECRET=1 — using the insecure development JWT key. Local development only.")
