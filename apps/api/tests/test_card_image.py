"""Tests for GET /api/actors/{id}/image endpoint (Phase 5 #28)."""

import io
import tempfile
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from database import get_db
from main import app
from models import ThreatActor
from tests.conftest import override_get_db


@pytest.fixture(autouse=True)
def reset_override():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides[get_db] = override_get_db


@pytest.fixture()
def image_test_actor(db_session: Session) -> ThreatActor:
    """Insert a minimal ThreatActor dedicated to image endpoint tests."""
    actor_id = "img-test-actor"
    # Clean up previous run if any
    existing = db_session.get(ThreatActor, actor_id)
    if existing:
        db_session.delete(existing)
        db_session.commit()

    actor = ThreatActor(
        id=actor_id,
        canonical_name="Image Test Actor",
        aliases=[],
        motivation=["espionage"],
        threat_level=5,
        sophistication="High",
        sectors=[],
        geographies=[],
        tools=[],
        ttps=[],
        campaigns=[],
        description="Actor for image endpoint tests.",
        rarity="RARE",
        sources=[],
        tlp="WHITE",
        last_updated=datetime(2026, 1, 1, tzinfo=UTC),
    )
    db_session.add(actor)
    db_session.commit()
    db_session.refresh(actor)
    yield actor

    # Cleanup
    db_session.delete(actor)
    db_session.commit()


# ---------------------------------------------------------------------------
# Image endpoint — actor not found
# ---------------------------------------------------------------------------


def test_image_returns_404_for_missing_actor(client: TestClient) -> None:
    resp = client.get("/api/actors/nonexistent-actor-xyz/image")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Image endpoint — actor found, no stored image → placeholder
# ---------------------------------------------------------------------------


def test_image_returns_png_for_existing_actor(
    client: TestClient, image_test_actor: ThreatActor
) -> None:
    resp = client.get(f"/api/actors/{image_test_actor.id}/image")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"


def test_image_content_is_not_empty(client: TestClient, image_test_actor: ThreatActor) -> None:
    resp = client.get(f"/api/actors/{image_test_actor.id}/image")
    assert len(resp.content) > 0


def test_image_placeholder_starts_with_png_signature(
    client: TestClient, image_test_actor: ThreatActor
) -> None:
    """PNG files always start with the 8-byte PNG signature."""
    resp = client.get(f"/api/actors/{image_test_actor.id}/image")
    # PNG magic bytes: \x89PNG\r\n\x1a\n
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"


# ---------------------------------------------------------------------------
# Image endpoint — actor found, stored image on disk
# ---------------------------------------------------------------------------


def test_image_serves_stored_file(
    client: TestClient, image_test_actor: ThreatActor, monkeypatch
) -> None:
    """When a PNG exists in IMAGE_STORAGE_DIR it should be served directly."""
    from PIL import Image

    import routers.actors as actors_router

    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a valid minimal 1×1 PNG
        img = Image.new("RGB", (1, 1), (0, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        img_path = Path(tmpdir) / f"{image_test_actor.id}.png"
        img_path.write_bytes(png_bytes)

        monkeypatch.setattr(actors_router, "IMAGE_STORAGE_DIR", Path(tmpdir))

        resp = client.get(f"/api/actors/{image_test_actor.id}/image")
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("image/png")
        assert resp.content == png_bytes


def test_image_fallback_when_no_stored_file(
    client: TestClient, image_test_actor: ThreatActor, monkeypatch
) -> None:
    """When no stored file exists, should still return a valid PNG placeholder."""
    import routers.actors as actors_router

    with tempfile.TemporaryDirectory() as tmpdir:
        # Empty dir — no stored image
        monkeypatch.setattr(actors_router, "IMAGE_STORAGE_DIR", Path(tmpdir))

        resp = client.get(f"/api/actors/{image_test_actor.id}/image")
        assert resp.status_code == 200
        assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
