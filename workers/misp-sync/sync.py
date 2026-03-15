"""
MISP connector for ThreatDex.

Fetches threat actor galaxy clusters from a self-hosted MISP instance and
normalises them to the canonical ThreatActorData schema.

Feature-flagged: skips gracefully if MISP_URL or MISP_API_KEY is not set.

Environment variables:
    MISP_URL       - Base URL of the MISP instance, e.g. https://misp.example.com
    MISP_API_KEY   - MISP automation key (read-only key is sufficient)
    MISP_VERIFY_SSL - Set to "false" to disable SSL verification (default: true)
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Path setup — allow importing from workers/shared/
# ---------------------------------------------------------------------------

_WORKERS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

from shared.models import SourceAttribution, ThreatActorData  # noqa: E402
from shared.rarity import compute_rarity, compute_threat_level  # noqa: E402

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional imports
# ---------------------------------------------------------------------------

try:
    import requests as _requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _requests = None  # type: ignore[assignment]
    _REQUESTS_AVAILABLE = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MISP_URL = os.environ.get("MISP_URL", "").rstrip("/")
MISP_API_KEY = os.environ.get("MISP_API_KEY", "")
MISP_VERIFY_SSL = os.environ.get("MISP_VERIFY_SSL", "true").lower() != "false"

# MISP galaxy UUIDs for threat actors
_THREAT_ACTOR_GALAXY_TYPE = "threat-actor"

# ---------------------------------------------------------------------------
# Country code mapping (ISO 3166-1 alpha-2 subset)
# ---------------------------------------------------------------------------

_COUNTRY_CODE_MAP: dict[str, str] = {
    "russia": "RU",
    "china": "CN",
    "north korea": "KP",
    "iran": "IR",
    "united states": "US",
    "vietnam": "VN",
    "india": "IN",
    "pakistan": "PK",
    "south korea": "KR",
    "israel": "IL",
    "ukraine": "UA",
    "turkey": "TR",
    "brazil": "BR",
    "nigeria": "NG",
    "indonesia": "ID",
}

# ---------------------------------------------------------------------------
# Slug helper
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _to_slug(name: str) -> str:
    """Convert a name to a URL-safe lowercase slug."""
    return _SLUG_RE.sub("-", name.lower()).strip("-")


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------


def _extract_country(meta: dict[str, Any]) -> tuple[str | None, str | None]:
    """Extract country name and ISO code from MISP cluster metadata."""
    country = meta.get("country") or meta.get("origin-country")
    if not country:
        return None, None
    country_str = str(country).strip()
    code = _COUNTRY_CODE_MAP.get(country_str.lower())
    return country_str, code


def _extract_motivation(meta: dict[str, Any]) -> list[str]:
    """Extract motivations from MISP cluster metadata."""
    valid_motivations = {"espionage", "financial", "sabotage", "hacktivism", "military"}
    raw = meta.get("cfr-suspected-victims-objectives") or meta.get("motivation") or []
    if isinstance(raw, str):
        raw = [raw]
    result: list[str] = []
    for m in raw:
        m_lower = m.lower()
        if m_lower in valid_motivations:
            result.append(m_lower)
        elif "espionage" in m_lower or "intelligence" in m_lower:
            result.append("espionage")
        elif "financial" in m_lower or "crime" in m_lower:
            result.append("financial")
        elif "sabotage" in m_lower or "destructive" in m_lower:
            result.append("sabotage")
        elif "hacktivist" in m_lower or "hacktivism" in m_lower:
            result.append("hacktivism")
        elif "military" in m_lower:
            result.append("military")
    return list(dict.fromkeys(result)) or ["espionage"]


def _extract_sophistication(meta: dict[str, Any]) -> str:
    """Map MISP sophistication to ThreatDex Sophistication enum."""
    raw = (meta.get("sophistication") or "").lower()
    if "nation" in raw or "elite" in raw:
        return "Nation-State Elite"
    if "very high" in raw or "advanced" in raw:
        return "Very High"
    if "high" in raw:
        return "High"
    if "medium" in raw or "intermediate" in raw:
        return "Medium"
    return "Low"


def _extract_sectors(meta: dict[str, Any]) -> list[str]:
    """Extract target sectors from MISP cluster metadata."""
    raw = meta.get("cfr-target-category") or meta.get("target-sector") or []
    if isinstance(raw, str):
        raw = [raw]
    return [str(s).strip() for s in raw if s]


def _extract_aliases(meta: dict[str, Any], cluster_value: str) -> list[str]:
    """Extract aliases / synonyms from MISP cluster metadata."""
    synonyms = meta.get("synonyms") or []
    if isinstance(synonyms, str):
        synonyms = [synonyms]
    aliases = [str(s).strip() for s in synonyms if s and str(s).strip() != cluster_value]
    return list(dict.fromkeys(aliases))


# ---------------------------------------------------------------------------
# Cluster normalisation
# ---------------------------------------------------------------------------


def normalise_cluster(cluster: dict[str, Any]) -> ThreatActorData | None:
    """Convert a MISP threat-actor galaxy cluster to ThreatActorData.

    Parameters
    ----------
    cluster:
        A MISP GalaxyCluster dict as returned by the REST API.

    Returns
    -------
    ThreatActorData | None
        Normalised actor, or None if the cluster cannot be processed.
    """
    try:
        value: str = cluster.get("value") or ""
        if not value:
            logger.warning("Skipping cluster with no value field")
            return None

        description: str = cluster.get("description") or ""
        meta: dict[str, Any] = cluster.get("meta") or {}
        uuid: str = cluster.get("uuid") or ""

        actor_id = _to_slug(value)
        aliases = _extract_aliases(meta, value)
        country, country_code = _extract_country(meta)
        motivation = _extract_motivation(meta)
        sophistication = _extract_sophistication(meta)

        # Date fields
        first_seen: str | None = str(meta["first-seen"])[:4] if meta.get("first-seen") else None
        last_seen: str | None = str(meta["last-seen"])[:4] if meta.get("last-seen") else None

        sectors = _extract_sectors(meta)

        sources = [
            SourceAttribution(
                source="misp",
                fetched_at=datetime.now(timezone.utc).isoformat(),
                source_id=uuid,
                url=f"{MISP_URL}/galaxy_clusters/view/{uuid}" if uuid else None,
            )
        ]

        threat_level = compute_threat_level(sophistication, 0, 0)
        rarity = compute_rarity(threat_level, sophistication, len(sources))

        return ThreatActorData(
            id=actor_id,
            canonical_name=value,
            description=description,
            aliases=aliases,
            country=country,
            country_code=country_code,
            motivation=motivation,
            threat_level=threat_level,
            sophistication=sophistication,
            first_seen=first_seen,
            last_seen=last_seen,
            sectors=sectors,
            rarity=rarity,
            sources=sources,
            tlp="WHITE",
        )

    except Exception:
        logger.error("Failed to normalise MISP cluster: %s", cluster.get("value"), exc_info=True)
        return None


# ---------------------------------------------------------------------------
# API client
# ---------------------------------------------------------------------------


def fetch_threat_actor_clusters(
    misp_url: str = MISP_URL,
    api_key: str = MISP_API_KEY,
    verify_ssl: bool = MISP_VERIFY_SSL,
) -> list[dict[str, Any]]:
    """Fetch all threat-actor galaxy clusters from the MISP REST API.

    Parameters
    ----------
    misp_url:
        Base URL of the MISP instance.
    api_key:
        MISP automation key.
    verify_ssl:
        Whether to verify the server SSL certificate.

    Returns
    -------
    list[dict]
        List of raw galaxy cluster dicts.
    """
    if not _REQUESTS_AVAILABLE or _requests is None:
        logger.error("requests library is not available")
        return []

    endpoint = f"{misp_url}/galaxy_clusters/index/published:1/type:{_THREAT_ACTOR_GALAXY_TYPE}.json"
    headers = {
        "Authorization": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        resp = _requests.get(
            endpoint,
            headers=headers,
            verify=verify_ssl,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        # MISP wraps results in a "GalaxyCluster" key sometimes
        if isinstance(data, dict):
            clusters = data.get("GalaxyCluster") or data.get("response") or []
        elif isinstance(data, list):
            clusters = data
        else:
            logger.warning("Unexpected MISP API response format: %s", type(data))
            clusters = []

        # Unwrap nested GalaxyCluster dicts if present
        result = []
        for item in clusters:
            if isinstance(item, dict) and "GalaxyCluster" in item:
                result.append(item["GalaxyCluster"])
            else:
                result.append(item)

        logger.info("Fetched %d MISP threat-actor clusters", len(result))
        return result

    except Exception as exc:
        logger.error("Failed to fetch MISP clusters: %s", exc, exc_info=True)
        return []


# ---------------------------------------------------------------------------
# Main sync function
# ---------------------------------------------------------------------------


def run_sync(
    engine: Any | None = None,
    misp_url: str = MISP_URL,
    api_key: str = MISP_API_KEY,
) -> int:
    """Run a full MISP sync.

    Feature-flags gracefully if MISP_URL or MISP_API_KEY are not configured.

    Parameters
    ----------
    engine:
        Optional SQLAlchemy engine for DB upserts. If None, actors are
        normalised and returned without persistence (useful for testing).
    misp_url:
        Override for the MISP instance URL.
    api_key:
        Override for the MISP API key.

    Returns
    -------
    int
        Number of actors successfully ingested.
    """
    if not misp_url:
        logger.warning("MISP_URL not configured — skipping MISP sync")
        return 0
    if not api_key:
        logger.warning("MISP_API_KEY not configured — skipping MISP sync")
        return 0

    clusters = fetch_threat_actor_clusters(misp_url, api_key)
    if not clusters:
        logger.info("No MISP clusters returned")
        return 0

    actors: list[ThreatActorData] = []
    for cluster in clusters:
        actor = normalise_cluster(cluster)
        if actor:
            actors.append(actor)

    logger.info("Normalised %d / %d MISP clusters to ThreatActorData", len(actors), len(clusters))

    if engine is None:
        return len(actors)

    try:
        from shared.db import upsert_actors

        upsert_actors(engine, actors, source="misp")
        logger.info("Upserted %d MISP actors to database", len(actors))
    except Exception as exc:
        logger.error("Failed to upsert MISP actors: %s", exc, exc_info=True)
        return 0

    return len(actors)
