# Contributing to ThreatDex

Thank you for your interest in contributing to ThreatDex. This guide covers everything
you need to get a local environment running, understand the codebase, and submit a
high-quality pull request.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Development Workflow](#development-workflow)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Adding a CTI Source Connector](#adding-a-cti-source-connector)
7. [PR Checklist](#pr-checklist)
8. [Reporting Bugs](#reporting-bugs)

---

## Prerequisites

| Tool        | Version  | Install                           |
|-------------|----------|-----------------------------------|
| Node.js     | >= 20    | https://nodejs.org                |
| pnpm        | >= 9     | `npm install -g pnpm`             |
| Python      | 3.11+    | https://www.python.org            |
| Docker      | latest   | https://docs.docker.com/get-docker/ |
| Docker Compose | v2+   | Bundled with Docker Desktop       |
| Git         | any      | https://git-scm.com               |

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/threatdex.git
cd threatdex

# 2. Install JavaScript dependencies (all workspaces)
pnpm install

# 3. Copy the environment template and fill in your values
cp .env.example .env
# Edit .env — at minimum, no changes are needed for local dev with Docker Compose

# 4. Start the full stack
docker compose -f infra/docker-compose.yml up

# Services:
#   PostgreSQL  → localhost:5432
#   Redis       → localhost:6379
#   FastAPI     → http://localhost:8000
#   Next.js     → http://localhost:3000
```

The first `docker compose up` will build the API and web images. Subsequent starts
are fast.

### Running services individually (without Docker)

**API (FastAPI):**
```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Web (Next.js):**
```bash
cd apps/web
pnpm dev
```

**Celery worker:**
```bash
cd apps/api
celery -A celery_app worker --loglevel=info
```

---

## Development Workflow

ThreatDex follows the branching strategy defined in `CLAUDE.md` section 8.

```
main   ← protected, production-ready
└── dev   ← integration branch, all PRs target here
    └── feature/issue-{N}-{short-slug}   ← your working branch
```

### Step-by-step

```bash
# 1. Start from a fresh dev branch
git checkout dev
git pull origin dev

# 2. Create your feature branch (use the GitHub issue number)
git checkout -b feature/issue-42-my-feature

# 3. Make changes, commit often with conventional commit messages:
git commit -m "feat: add MISP galaxy cluster ingestion"
git commit -m "fix: deduplicate aliases before upsert"
git commit -m "test: add pytest coverage for MISP connector"
git commit -m "docs: document MISP setup in DATA_SOURCES.md"

# 4. Before opening a PR, run all checks:
pnpm lint && pnpm test          # frontend + packages
cd apps/api && ruff check . && pytest   # backend

# 5. Push and open a PR against dev
git push origin feature/issue-42-my-feature
# Open PR on GitHub: feature/issue-42-my-feature → dev
# PR title: [Issue #42] Brief description
```

**Never push directly to `main` or `dev`.**

### Conventional Commit Types

| Prefix   | When to use                                      |
|----------|--------------------------------------------------|
| `feat:`  | New feature or capability                        |
| `fix:`   | Bug fix                                          |
| `chore:` | Maintenance — deps, config, tooling              |
| `test:`  | Adding or updating tests                         |
| `docs:`  | Documentation changes                            |
| `refactor:` | Code restructuring without behaviour change  |
| `perf:`  | Performance improvement                          |
| `ci:`    | CI/CD workflow changes                           |

---

## Code Style

### TypeScript / JavaScript

- Formatter: **Prettier** (config in root `.prettierrc` if present, otherwise defaults)
- Linter: **ESLint** (config per package)
- Run: `pnpm lint` from the repo root

Key rules:
- No `console.log` in committed code — use a proper logger
- Prefer named exports over default exports in library packages
- All React components must have explicit TypeScript prop types
- Use `const` by default; `let` only when reassignment is needed

### Python

- Formatter + linter: **Ruff** (`ruff check` and `ruff format`)
- Run: `ruff check apps/api workers` from the repo root

Key rules:
- No `print()` debug statements — use `logging`
- All functions must have type annotations
- Pydantic v2 models for all request/response shapes
- SQLAlchemy 2 style (`select()`, `session.scalars()`)

---

## Testing

### Frontend (Vitest + Playwright)

```bash
# Unit tests (Vitest)
pnpm test

# End-to-end tests (Playwright) — requires running stack
pnpm exec playwright test
```

Requirements:
- Every new page route needs a Playwright smoke test
- Every new component needs a Vitest unit test
- Tests live in `__tests__/` or alongside the component as `*.test.ts(x)`

### Backend (pytest)

```bash
cd apps/api
pytest tests/ --cov=. --cov-report=term-missing
```

Requirements:
- Every new endpoint needs a happy-path test and an error-case test
- Worker tests must mock the upstream HTTP call (use `httpx` or `responses`)
- Worker tests must assert that normalised output matches the `ThreatActor` schema
- Do not merge if coverage drops below the current baseline

---

## Adding a CTI Source Connector

Use this template when implementing a new CTI data source.

### File structure

```
workers/
└── my-source/
    ├── __init__.py
    ├── connector.py      ← main ingestion logic
    ├── normalise.py      ← map source schema → ThreatActor
    ├── requirements.txt  ← source-specific deps (if any)
    └── tests/
        └── test_connector.py
```

### connector.py template

```python
"""
My Source connector for ThreatDex.

Ingests threat actor data from My Source and normalises it into the
canonical ThreatActor schema.

Required env vars:
    MY_SOURCE_API_KEY  — obtain from https://my-source.example.com/api

Feature-flagged: if MY_SOURCE_API_KEY is not set, this connector is skipped.
"""
import logging
import os
from datetime import datetime, timezone
from typing import List

from apps.api.schemas import ThreatActorCreate, SourceAttribution

logger = logging.getLogger(__name__)

SOURCE_NAME = "my-source"
BASE_URL = "https://api.my-source.example.com/v1"


def is_enabled() -> bool:
    """Return True if this connector is configured and should run."""
    key = os.getenv("MY_SOURCE_API_KEY")
    if not key:
        logger.warning(
            "MY_SOURCE_API_KEY is not set — My Source connector is disabled."
        )
        return False
    return True


async def fetch_actors() -> List[ThreatActorCreate]:
    """
    Fetch and normalise threat actors from My Source.

    Returns an empty list if the connector is disabled or the upstream
    call fails — never raises an exception that would crash the worker.
    """
    if not is_enabled():
        return []

    try:
        raw_actors = await _fetch_raw()
        return [_normalise(a) for a in raw_actors]
    except Exception:
        logger.exception("My Source sync failed — skipping this run.")
        return []


async def _fetch_raw() -> List[dict]:
    """Make the upstream API call and return raw response objects."""
    import httpx

    api_key = os.getenv("MY_SOURCE_API_KEY")
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(
            f"{BASE_URL}/actors",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        response.raise_for_status()
        return response.json()["data"]


def _normalise(raw: dict) -> ThreatActorCreate:
    """Map a raw My Source actor object to ThreatActorCreate."""
    return ThreatActorCreate(
        id=raw["slug"],
        canonicalName=raw["name"],
        aliases=raw.get("aliases", []),
        description=raw.get("description", ""),
        # ... map remaining fields ...
        sources=[
            SourceAttribution(
                source="manual",          # use the closest registered source type
                sourceId=str(raw["id"]),
                fetchedAt=datetime.now(timezone.utc).isoformat(),
                url=f"https://my-source.example.com/actors/{raw['slug']}",
            )
        ],
        tlp="WHITE",
        lastUpdated=datetime.now(timezone.utc).isoformat(),
    )
```

### tests/test_connector.py template

```python
"""Tests for the My Source connector."""
import pytest
from unittest.mock import AsyncMock, patch

from workers.my_source.connector import fetch_actors


@pytest.fixture
def mock_raw_response():
    return {
        "data": [
            {
                "id": 1,
                "slug": "example-apt",
                "name": "Example APT",
                "aliases": ["APT-Example"],
                "description": "A fictional threat actor for testing.",
            }
        ]
    }


@pytest.mark.asyncio
async def test_fetch_actors_happy_path(mock_raw_response, monkeypatch):
    """Connector returns normalised actors when API call succeeds."""
    monkeypatch.setenv("MY_SOURCE_API_KEY", "test-key")

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value.json.return_value = mock_raw_response
        mock_get.return_value.raise_for_status = lambda: None

        actors = await fetch_actors()

    assert len(actors) == 1
    assert actors[0].id == "example-apt"
    assert actors[0].canonicalName == "Example APT"
    assert "APT-Example" in actors[0].aliases


@pytest.mark.asyncio
async def test_fetch_actors_no_api_key(monkeypatch):
    """Connector returns empty list when API key is not set."""
    monkeypatch.delenv("MY_SOURCE_API_KEY", raising=False)
    actors = await fetch_actors()
    assert actors == []


@pytest.mark.asyncio
async def test_fetch_actors_network_error(monkeypatch):
    """Connector returns empty list on network failure — does not raise."""
    monkeypatch.setenv("MY_SOURCE_API_KEY", "test-key")

    with patch("httpx.AsyncClient.get", side_effect=Exception("network error")):
        actors = await fetch_actors()

    assert actors == []
```

---

## PR Checklist

Before requesting review, confirm:

- [ ] Branch is named `feature/issue-{N}-{short-slug}`
- [ ] PR targets `dev`, not `main`
- [ ] PR title follows format: `[Issue #{N}] Brief description`
- [ ] PR description uses the template from `CLAUDE.md` section 9
- [ ] All new code has tests (unit + integration as appropriate)
- [ ] `pnpm lint && pnpm test` passes (frontend/packages)
- [ ] `ruff check . && pytest` passes (backend/workers)
- [ ] No `console.log` or `print()` debug statements
- [ ] No secrets committed — all credentials read from environment
- [ ] `CLAUDE.md` has not been modified (requires separate PR)
- [ ] If UI changed: screenshots included in PR description

---

## Reporting Bugs

Please open a GitHub Issue with:

1. A clear title describing the problem
2. Steps to reproduce
3. Expected behaviour
4. Actual behaviour
5. Environment details (OS, Node version, Python version, Docker version)

For security vulnerabilities, do **not** open a public issue. Follow the
responsible disclosure process in [SECURITY.md](SECURITY.md).
