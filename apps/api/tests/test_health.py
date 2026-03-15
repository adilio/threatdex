"""Tests for the /health liveness endpoint."""

from fastapi.testclient import TestClient


def test_health_returns_200(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_body_contains_status_ok(client: TestClient) -> None:
    data = client.get("/health").json()
    assert data["status"] == "ok"


def test_health_body_contains_version(client: TestClient) -> None:
    data = client.get("/health").json()
    assert "version" in data
    assert data["version"] == "0.1.0"
