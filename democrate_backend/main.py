from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, "args") and isinstance(record.args, tuple) and len(record.args) >= 5:
            if record.args[4] == 200 or record.args[4] == "200":
                return False
        return record.getMessage().find(" 200 ") == -1

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())
from config import settings
from dependencies import auth_limiter, general_limiter, client_ip
from routes import auth, complaints, leaderboard, ratings, admin, developer

app = FastAPI(title=settings.PROJECT_NAME)

# CORS — env-driven list of allowed origins (defaults cover local dev).
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith(settings.API_V1_STR):
        # Per-IP buckets keyed by API section. Auth endpoints get a stricter
        # budget. Availability probing fires once per typing pause, so it gets
        # its own generous bucket and can't starve the strict login/register
        # bucket (brute-force protection).
        if path.startswith(f"{settings.API_V1_STR}/auth/check-id"):
            limiter, bucket = auth_limiter, "check-id"
        elif path == f"{settings.API_V1_STR}/auth/me":
            # Authenticated identity reads get their own bucket so every SPA
            # page-load/refresh doesn't consume the strict login budget.
            limiter, bucket = general_limiter, "me"
        elif path.startswith(f"{settings.API_V1_STR}/auth"):
            limiter, bucket = auth_limiter, "auth"
        else:
            limiter, bucket = general_limiter, "api"
        if not limiter.allow(f"{client_ip(request)}:{bucket}"):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
                headers={"Retry-After": str(settings.RATE_WINDOW_SECONDS)},
            )
    return await call_next(request)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=400,
        content={"detail": "That operation conflicts with existing data. Please refresh and try again."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(x) for x in first.get("loc", []) if x != "body")
    msg = first.get("msg", "Invalid request")
    return JSONResponse(
        status_code=422,
        content={"detail": f"{field}: {msg}" if field else msg},
    )


app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(complaints.router, prefix=f"{settings.API_V1_STR}/complaints", tags=["complaints"])
app.include_router(leaderboard.router, prefix=f"{settings.API_V1_STR}/leaderboard", tags=["leaderboard"])
app.include_router(ratings.router, prefix=f"{settings.API_V1_STR}/ratings", tags=["ratings"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(developer.router, prefix=f"{settings.API_V1_STR}/developer", tags=["developer"])


@app.get("/")
def read_root():
    return {"message": "Welcome to Democrate API"}
