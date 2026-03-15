"""Tests for the /api/search endpoint."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from database import get_db
from main import app
from models import ThreatActor
from tests.conftest import TestingSessionLocal, override_get_db


@pytest.fixture(autouse=True)
def reset_override():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides[get_db] = override_get_db


def _seed_actor(db: Session, *, actor_id: str, canonical_name: str, tools: list | None = None) -> ThreatActor:
    actor = ThreatActor(
        id=actor_id,
        canonical_name=canonical_name,
        aliases=[],
        motivation=["espionage"],
        threat_level=5,
        sophistication="Medium",
        sectors=[],
        geographies=[],
        tools=tools or [],
        ttps=[],
        campaigns=[],
        description="A test actor for search.",
        rarity="RARE",
        sources=[],
        tlp="WHITE",
        last_updated=datetime(2026, 1, 1, tzinfo=UTC),
    )
    db.add(actor)
    db.commit()
    db.refresh(actor)
    return actor


# ── Happy-path tests ──────────────────────────────────────────────────────────


def test_search_by_name(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _seed_actor(db, actor_id="apt-search-1", canonical_name="APT Search One")
    finally:
        db.close()

    response = client.get("/api/search?q=APT Search")
    assert response.status_code == 200
    body = response.json()
    ids = [a["id"] for a in body["items"]]
    assert "apt-search-1" in ids


def test_search_by_tool(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _seed_actor(
            db,
            actor_id="toolsearch-actor",
            canonical_name="Tool Search Actor",
            tools=["Cobalt Strike", "Mimikatz"],
        )
    finally:
        db.close()

    response = client.get("/api/search?q=Cobalt")
    assert response.status_code == 200
    body = response.json()
    ids = [a["id"] for a in body["items"]]
    assert "toolsearch-actor" in ids


def test_search_returns_paginated_response(client: TestClient) -> None:
    response = client.get("/api/search?q=actor")
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert "limit" in body
    assert "offset" in body


# ── Error cases ───────────────────────────────────────────────────────────────


def test_search_query_too_short_returns_400(client: TestClient) -> None:
    response = client.get("/api/search?q=a")
    assert response.status_code == 400
    assert "2 characters" in response.json()["detail"]


def test_search_query_missing_returns_422(client: TestClient) -> None:
    """Missing required 'q' parameter should return 422 Unprocessable Entity."""
    response = client.get("/api/search")
    assert response.status_code == 422


def test_search_no_results(client: TestClient) -> None:
    response = client.get("/api/search?q=zzznomatch999")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
