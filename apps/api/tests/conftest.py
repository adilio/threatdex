"""
Shared pytest fixtures for the ThreatDex API test suite.

Uses an in-memory SQLite database for speed — no external services required.
"""

import os
from datetime import datetime, timezone
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Point the app at the in-memory SQLite database *before* importing app code
# that reads DATABASE_URL at module level.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("ADMIN_SECRET", "test-secret")

from database import Base, get_db  # noqa: E402
from main import app  # noqa: E402
from models import ThreatActor  # noqa: E402

# ── SQLite in-memory engine ───────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    """Yield a fresh database session; roll back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    """Yield a synchronous TestClient backed by the in-memory database."""
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def sample_actor(db_session: Session) -> ThreatActor:
    """Insert and return a minimal ThreatActor suitable for most tests."""
    actor = ThreatActor(
        id="apt28",
        canonical_name="APT28",
        aliases=["Fancy Bear", "Sofacy", "Pawn Storm"],
        mitre_id="G0007",
        country="Russia",
        country_code="RU",
        motivation=["espionage", "military"],
        threat_level=9,
        sophistication="Nation-State Elite",
        first_seen="2004",
        last_seen="2024",
        sectors=["Government", "Defence", "Media"],
        geographies=["Europe", "North America"],
        tools=["Mimikatz", "X-Agent", "Zebrocy"],
        ttps=[
            {"techniqueId": "T1566", "techniqueName": "Phishing", "tactic": "Initial Access"},
            {
                "techniqueId": "T1059",
                "techniqueName": "Command and Scripting Interpreter",
                "tactic": "Execution",
            },
        ],
        campaigns=[
            {
                "name": "Operation Pawn Storm",
                "year": "2014",
                "description": "Cyber espionage campaign targeting NATO members.",
            }
        ],
        description=(
            "APT28 is a threat group attributed to Russia's GRU. "
            "Active since at least 2004, it primarily conducts espionage operations."
        ),
        tagline="Russia's cyber spear, forged in the shadows of the Kremlin.",
        rarity="MYTHIC",
        sources=[
            {
                "source": "mitre",
                "sourceId": "G0007",
                "fetchedAt": "2026-01-01T00:00:00Z",
                "url": "https://attack.mitre.org/groups/G0007/",
            }
        ],
        tlp="WHITE",
        last_updated=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    db_session.add(actor)
    db_session.commit()
    db_session.refresh(actor)

    # Make the override session use the same committed data
    app.dependency_overrides[get_db] = lambda: iter([db_session])

    return actor
