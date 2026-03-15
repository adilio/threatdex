import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import actors, admin, search, sources

logging.basicConfig(level=settings.LOG_LEVEL.upper())
logger = logging.getLogger(__name__)

APP_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup + shutdown."""
    logger.info("ThreatDex API starting up (v%s)", APP_VERSION)

    # Create DB tables if they don't already exist (idempotent bootstrap).
    # Production deployments should use Alembic migrations instead.
    try:
        from database import create_all_tables

        create_all_tables()
        logger.info("Database tables verified/created successfully")
    except Exception as exc:
        logger.warning("Could not initialise database tables: %s", exc)

    yield

    logger.info("ThreatDex API shutting down")


app = FastAPI(
    title="ThreatDex API",
    description=(
        "Aggregates cyber threat actor intelligence from public CTI feeds and exposes "
        "it as structured JSON. Know your adversaries, card by card."
    ),
    version=APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(actors.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/health", tags=["health"])
def health_check() -> dict:
    """Liveness probe — always returns 200 when the process is alive."""
    return {"status": "ok", "version": APP_VERSION}
