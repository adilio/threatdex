"""Tests for GET /api/sources endpoint."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from database import get_db
from main import app
from models import SyncLog
from tests.conftest import override_get_db


@pytest.fixture(autouse=True)
def reset_override():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides[get_db] = override_get_db


@pytest.fixture()
def clean_sync_logs(db_session: Session):
    """Delete all SyncLog rows before/after each test for isolation."""
    db_session.query(SyncLog).delete()
    db_session.commit()
    yield
    db_session.query(SyncLog).delete()
    db_session.commit()


def _add_sync_log(
    db: Session,
    source: str,
    status: str = "success",
    records_synced: int = 10,
    completed_at: datetime | None = None,
) -> SyncLog:
    log = SyncLog(
        source=source,
        started_at=datetime(2026, 1, 1, tzinfo=UTC),
        completed_at=completed_at or datetime(2026, 1, 1, 1, tzinfo=UTC),
        status=status,
        records_synced=records_synced,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ---------------------------------------------------------------------------
# Basic shape tests
# ---------------------------------------------------------------------------


def test_sources_returns_200(client: TestClient, clean_sync_logs) -> None:
    resp = client.get("/api/sources")
    assert resp.status_code == 200


def test_sources_returns_list(client: TestClient, clean_sync_logs) -> None:
    resp = client.get("/api/sources")
    assert isinstance(resp.json(), list)


def test_sources_returns_all_known_sources(client: TestClient, clean_sync_logs) -> None:
    """All 5 configured sources should be present even with no sync logs."""
    resp = client.get("/api/sources")
    data = resp.json()
    source_names = {item["source"] for item in data}
    assert source_names == {"mitre", "etda", "otx", "misp", "opencti"}


def test_sources_null_when_never_synced(client: TestClient, clean_sync_logs) -> None:
    """Sources that have never been synced should have null last_sync and status."""
    resp = client.get("/api/sources")
    data = resp.json()
    never_synced = [item for item in data if item["last_sync"] is None]
    # All 5 should be null since we cleared logs
    assert len(never_synced) == 5


# ---------------------------------------------------------------------------
# Sync log presence tests
# ---------------------------------------------------------------------------


def test_sources_shows_last_sync_timestamp(
    client: TestClient, db_session: Session, clean_sync_logs
) -> None:
    _add_sync_log(db_session, "mitre", status="success", records_synced=42)
    resp = client.get("/api/sources")
    data = resp.json()
    mitre = next(item for item in data if item["source"] == "mitre")
    assert mitre["last_sync"] is not None
    assert mitre["status"] == "success"
    assert mitre["records_synced"] == 42


def test_sources_shows_most_recent_log(
    client: TestClient, db_session: Session, clean_sync_logs
) -> None:
    """When multiple logs exist for the same source, the most recent is shown."""
    # Older log
    old_log = SyncLog(
        source="etda",
        started_at=datetime(2025, 6, 1, tzinfo=UTC),
        completed_at=datetime(2025, 6, 1, 1, tzinfo=UTC),
        status="success",
        records_synced=5,
    )
    db_session.add(old_log)
    # Newer log (higher started_at)
    new_log = SyncLog(
        source="etda",
        started_at=datetime(2026, 1, 1, tzinfo=UTC),
        completed_at=datetime(2026, 1, 1, 1, tzinfo=UTC),
        status="success",
        records_synced=99,
    )
    db_session.add(new_log)
    db_session.commit()

    resp = client.get("/api/sources")
    data = resp.json()
    etda = next(item for item in data if item["source"] == "etda")
    assert etda["records_synced"] == 99


def test_sources_shows_failed_status(
    client: TestClient, db_session: Session, clean_sync_logs
) -> None:
    _add_sync_log(db_session, "otx", status="error", records_synced=0)
    resp = client.get("/api/sources")
    data = resp.json()
    otx = next(item for item in data if item["source"] == "otx")
    assert otx["status"] == "error"


def test_sources_multiple_sources_populated(
    client: TestClient, db_session: Session, clean_sync_logs
) -> None:
    """Multiple sources can have sync logs simultaneously."""
    _add_sync_log(db_session, "mitre", records_synced=100)
    _add_sync_log(db_session, "etda", records_synced=50)
    resp = client.get("/api/sources")
    data = resp.json()

    synced = {item["source"]: item for item in data if item["last_sync"] is not None}
    assert "mitre" in synced
    assert "etda" in synced
    assert synced["mitre"]["records_synced"] == 100
    assert synced["etda"]["records_synced"] == 50


def test_sources_item_schema(client: TestClient, clean_sync_logs) -> None:
    """Each item must expose 'source', 'last_sync', 'status', 'records_synced'."""
    resp = client.get("/api/sources")
    data = resp.json()
    required_keys = {"source", "last_sync", "status", "records_synced"}
    for item in data:
        assert required_keys.issubset(item.keys()), f"Missing keys in: {item}"
