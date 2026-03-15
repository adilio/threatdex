"""Tests for POST /api/admin/sync/{source} endpoint."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from database import get_db
from main import app
from tests.conftest import override_get_db


@pytest.fixture(autouse=True)
def reset_override():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides[get_db] = override_get_db


# ---------------------------------------------------------------------------
# Authentication tests
# ---------------------------------------------------------------------------


def test_sync_requires_admin_secret(client: TestClient) -> None:
    """Request without ADMIN_SECRET header should return 401."""
    resp = client.post("/api/admin/sync/mitre")
    assert resp.status_code == 401


def test_sync_wrong_secret_returns_401(client: TestClient) -> None:
    """Wrong ADMIN_SECRET header should return 401."""
    resp = client.post("/api/admin/sync/mitre", headers={"ADMIN_SECRET": "wrong"})
    assert resp.status_code == 401


def test_sync_correct_secret_accepted(client: TestClient) -> None:
    """Correct ADMIN_SECRET with a valid source should return 200."""
    with patch("celery_app.celery_app") as mock_celery:
        mock_celery.send_task = MagicMock()
        resp = client.post("/api/admin/sync/mitre", headers={"ADMIN_SECRET": "test-secret"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Valid / invalid source tests
# ---------------------------------------------------------------------------


def test_sync_valid_sources(client: TestClient) -> None:
    """Each valid source should return status=queued."""
    valid_sources = ["mitre", "etda", "otx", "misp", "opencti"]
    for source in valid_sources:
        with patch("celery_app.celery_app") as mock_celery:
            mock_celery.send_task = MagicMock()
            resp = client.post(
                f"/api/admin/sync/{source}",
                headers={"ADMIN_SECRET": "test-secret"},
            )
        assert resp.status_code == 200, f"Expected 200 for source '{source}'"
        data = resp.json()
        assert data["status"] == "queued"
        assert data["source"] == source


def test_sync_invalid_source_returns_400(client: TestClient) -> None:
    """Unknown source name should return 400."""
    resp = client.post(
        "/api/admin/sync/unknown_source",
        headers={"ADMIN_SECRET": "test-secret"},
    )
    assert resp.status_code == 400
    assert "unknown_source" in resp.json()["detail"].lower()


def test_sync_response_body_shape(client: TestClient) -> None:
    """Response body must contain 'status' and 'source' keys."""
    with patch("celery_app.celery_app") as mock_celery:
        mock_celery.send_task = MagicMock()
        resp = client.post(
            "/api/admin/sync/etda",
            headers={"ADMIN_SECRET": "test-secret"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body
    assert "source" in body
    assert body["source"] == "etda"


# ---------------------------------------------------------------------------
# Celery graceful degradation
# ---------------------------------------------------------------------------


def test_sync_celery_unavailable_still_returns_200(client: TestClient) -> None:
    """If Celery/Redis is unavailable the endpoint degrades gracefully (no 500)."""
    # Patch send_task on the already-imported celery_app object to raise
    with patch("celery_app.celery_app.send_task", side_effect=Exception("Redis down")):
        resp = client.post(
            "/api/admin/sync/mitre",
            headers={"ADMIN_SECRET": "test-secret"},
        )
    # The router catches the exception and still returns 200
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"


def test_sync_sends_celery_task(client: TestClient) -> None:
    """A successful call must attempt to enqueue a Celery task."""
    with patch("celery_app.celery_app") as mock_celery:
        mock_send = MagicMock()
        mock_celery.send_task = mock_send
        client.post(
            "/api/admin/sync/mitre",
            headers={"ADMIN_SECRET": "test-secret"},
        )
    mock_send.assert_called_once()
    call_kwargs = mock_send.call_args
    # First positional arg is the task name
    assert "mitre" in call_kwargs[0][0]
