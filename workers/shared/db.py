"""
Database utilities shared across all ingestion workers.

Provides:
- Engine factory from DATABASE_URL env var
- upsert_actor() — insert-or-update a ThreatActorData record
- log_sync_start / log_sync_complete / log_sync_error — sync audit log helpers
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import create_engine as _sa_create_engine, text
from sqlalchemy.engine import Engine

from .models import ThreatActorData, to_db_dict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine factory
# ---------------------------------------------------------------------------

_engine_cache: Engine | None = None


def get_engine(database_url: str | None = None) -> Engine:
    """Return a cached SQLAlchemy engine.

    Parameters
    ----------
    database_url:
        Explicit URL; falls back to DATABASE_URL environment variable.

    Raises
    ------
    RuntimeError
        If no database URL is available.
    """
    global _engine_cache
    if _engine_cache is not None:
        return _engine_cache

    url = database_url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Cannot connect to the database."
        )

    _engine_cache = _sa_create_engine(url, pool_pre_ping=True, future=True)
    return _engine_cache


# Keep the original name for backwards compatibility
create_engine = get_engine


# ---------------------------------------------------------------------------
# Actor upsert
# ---------------------------------------------------------------------------

def _jsonb(value: Any) -> str:
    """Encode a Python object to a JSON string for use in a JSONB column."""
    return json.dumps(value, default=str)


def upsert_actor(engine: Engine, actor: ThreatActorData) -> None:
    """Insert or update a threat actor record.

    Uses PostgreSQL INSERT … ON CONFLICT DO UPDATE (upsert) so that repeated
    syncs are idempotent.

    Parameters
    ----------
    engine:
        SQLAlchemy engine pointing at the ThreatDex database.
    actor:
        Normalised actor data to persist.
    """
    record = to_db_dict(actor)

    # JSONB columns must be passed as JSON strings when using textual SQL.
    jsonb_fields = {
        "aliases", "motivation", "sectors", "geographies",
        "tools", "ttps", "campaigns", "sources",
    }

    # Build bind-param dict — encode JSONB fields
    params: dict[str, Any] = {}
    for key, value in record.items():
        params[key] = _jsonb(value) if key in jsonb_fields else value

    stmt = text(
        """
        INSERT INTO threat_actors (
            id, canonical_name, aliases, mitre_id,
            country, country_code, motivation, threat_level, sophistication,
            first_seen, last_seen, sectors, geographies, tools,
            ttps, campaigns, description, tagline, rarity,
            image_url, image_prompt, sources, tlp, last_updated
        ) VALUES (
            :id, :canonical_name, :aliases::jsonb, :mitre_id,
            :country, :country_code, :motivation::jsonb, :threat_level, :sophistication,
            :first_seen, :last_seen, :sectors::jsonb, :geographies::jsonb, :tools::jsonb,
            :ttps::jsonb, :campaigns::jsonb, :description, :tagline, :rarity,
            :image_url, :image_prompt, :sources::jsonb, :tlp, :last_updated
        )
        ON CONFLICT (id) DO UPDATE SET
            canonical_name  = EXCLUDED.canonical_name,
            aliases         = EXCLUDED.aliases,
            mitre_id        = EXCLUDED.mitre_id,
            country         = EXCLUDED.country,
            country_code    = EXCLUDED.country_code,
            motivation      = EXCLUDED.motivation,
            threat_level    = EXCLUDED.threat_level,
            sophistication  = EXCLUDED.sophistication,
            first_seen      = EXCLUDED.first_seen,
            last_seen       = EXCLUDED.last_seen,
            sectors         = EXCLUDED.sectors,
            geographies     = EXCLUDED.geographies,
            tools           = EXCLUDED.tools,
            ttps            = EXCLUDED.ttps,
            campaigns       = EXCLUDED.campaigns,
            description     = EXCLUDED.description,
            tagline         = EXCLUDED.tagline,
            rarity          = EXCLUDED.rarity,
            image_url       = COALESCE(EXCLUDED.image_url, threat_actors.image_url),
            image_prompt    = COALESCE(EXCLUDED.image_prompt, threat_actors.image_prompt),
            sources         = EXCLUDED.sources,
            tlp             = EXCLUDED.tlp,
            last_updated    = EXCLUDED.last_updated
        """
    )

    with engine.begin() as conn:
        conn.execute(stmt, params)

    logger.debug("Upserted actor: %s (%s)", actor.id, actor.canonical_name)


# ---------------------------------------------------------------------------
# Sync audit log helpers
# ---------------------------------------------------------------------------

def log_sync_start(engine: Engine, source: str) -> int:
    """Insert a sync_logs row and return its generated log_id.

    Parameters
    ----------
    engine:
        SQLAlchemy engine.
    source:
        One of "mitre", "etda", "otx", "misp", "opencti".

    Returns
    -------
    int
        The auto-generated primary key of the new log row.
    """
    stmt = text(
        """
        INSERT INTO sync_logs (source, started_at, status)
        VALUES (:source, :started_at, 'running')
        RETURNING id
        """
    )
    with engine.begin() as conn:
        row = conn.execute(
            stmt,
            {"source": source, "started_at": datetime.now(timezone.utc).isoformat()},
        ).fetchone()

    log_id: int = row[0]  # type: ignore[index]
    logger.info("Sync started — source=%s log_id=%d", source, log_id)
    return log_id


def log_sync_complete(engine: Engine, log_id: int, records_synced: int) -> None:
    """Mark a sync log entry as completed.

    Parameters
    ----------
    engine:
        SQLAlchemy engine.
    log_id:
        The log row to update, returned by log_sync_start().
    records_synced:
        Number of actor records successfully upserted.
    """
    stmt = text(
        """
        UPDATE sync_logs
        SET status = 'completed',
            finished_at = :finished_at,
            records_synced = :records_synced
        WHERE id = :log_id
        """
    )
    with engine.begin() as conn:
        conn.execute(
            stmt,
            {
                "log_id": log_id,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "records_synced": records_synced,
            },
        )
    logger.info("Sync completed — log_id=%d records=%d", log_id, records_synced)


def log_sync_error(engine: Engine, log_id: int, error: str) -> None:
    """Mark a sync log entry as failed with an error message.

    Parameters
    ----------
    engine:
        SQLAlchemy engine.
    log_id:
        The log row to update.
    error:
        Human-readable error description (truncated to 2 000 chars).
    """
    stmt = text(
        """
        UPDATE sync_logs
        SET status = 'error',
            finished_at = :finished_at,
            error_message = :error_message
        WHERE id = :log_id
        """
    )
    with engine.begin() as conn:
        conn.execute(
            stmt,
            {
                "log_id": log_id,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "error_message": error[:2000],
            },
        )
    logger.error("Sync failed — log_id=%d error=%s", log_id, error)
