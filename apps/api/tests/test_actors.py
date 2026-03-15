"""Tests for /api/actors endpoints."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from database import get_db
from main import app
from models import ThreatActor
from tests.conftest import TestingSessionLocal, override_get_db


# Reset the dependency override before each test so we always use the clean session
@pytest.fixture(autouse=True)
def reset_override():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides[get_db] = override_get_db


def _make_actor(
    db: Session,
    *,
    actor_id: str = "test-actor",
    canonical_name: str = "Test Actor",
    country: str = "Russia",
    motivation: list | None = None,
    threat_level: int = 7,
) -> ThreatActor:
    actor = ThreatActor(
        id=actor_id,
        canonical_name=canonical_name,
        aliases=[],
        motivation=motivation or ["espionage"],
        threat_level=threat_level,
        sophistication="High",
        sectors=[],
        geographies=[],
        tools=[],
        ttps=[],
        campaigns=[],
        description="A test actor.",
        rarity="RARE",
        sources=[],
        tlp="WHITE",
        country=country,
        last_updated=datetime(2026, 1, 1, tzinfo=UTC),
    )
    db.add(actor)
    db.commit()
    db.refresh(actor)
    return actor


# ── List endpoint ─────────────────────────────────────────────────────────────


def test_list_actors_empty(client: TestClient) -> None:
    response = client.get("/api/actors")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["limit"] == 20
    assert body["offset"] == 0


def test_list_actors_returns_seeded_actor(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _make_actor(db, actor_id="apt41", canonical_name="APT41")
    finally:
        db.close()

    response = client.get("/api/actors")
    assert response.status_code == 200
    body = response.json()
    ids = [a["id"] for a in body["items"]]
    assert "apt41" in ids


def test_list_actors_pagination(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        for i in range(5):
            _make_actor(db, actor_id=f"pag-actor-{i}", canonical_name=f"Pag Actor {i}")
    finally:
        db.close()

    response = client.get("/api/actors?limit=2&offset=0")
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) <= 2
    assert body["limit"] == 2
    assert body["offset"] == 0


def test_list_actors_country_filter(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _make_actor(db, actor_id="ru-actor", canonical_name="Russian Actor", country="Russia")
        _make_actor(db, actor_id="cn-actor", canonical_name="Chinese Actor", country="China")
    finally:
        db.close()

    response = client.get("/api/actors?country=Russia")
    assert response.status_code == 200
    body = response.json()
    for actor in body["items"]:
        assert actor["country"] == "Russia"


def test_list_actors_search_filter(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _make_actor(db, actor_id="lazarus-grp", canonical_name="Lazarus Group")
    finally:
        db.close()

    response = client.get("/api/actors?search=lazarus")
    assert response.status_code == 200
    body = response.json()
    ids = [a["id"] for a in body["items"]]
    assert "lazarus-grp" in ids


# ── Detail endpoint ───────────────────────────────────────────────────────────


def test_get_actor_detail(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _make_actor(db, actor_id="kimsuky", canonical_name="Kimsuky")
    finally:
        db.close()

    response = client.get("/api/actors/kimsuky")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "kimsuky"
    assert body["canonicalName"] == "Kimsuky"


def test_get_actor_not_found(client: TestClient) -> None:
    response = client.get("/api/actors/nonexistent-actor-xyz")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Card endpoints ────────────────────────────────────────────────────────────


def test_card_front_returns_png(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _make_actor(db, actor_id="card-test-actor", canonical_name="Card Test Actor")
    finally:
        db.close()

    response = client.get("/api/actors/card-test-actor/card/front")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    # PNG magic bytes: \x89PNG
    assert response.content[:4] == b"\x89PNG"


def test_card_back_returns_png(client: TestClient) -> None:
    db = TestingSessionLocal()
    try:
        _make_actor(db, actor_id="card-back-test", canonical_name="Card Back Test")
    finally:
        db.close()

    response = client.get("/api/actors/card-back-test/card/back")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content[:4] == b"\x89PNG"


def test_card_front_not_found(client: TestClient) -> None:
    response = client.get("/api/actors/ghost-actor/card/front")
    assert response.status_code == 404
