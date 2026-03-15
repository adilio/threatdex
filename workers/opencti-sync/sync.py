"""
OpenCTI connector for ThreatDex.

Fetches intrusion sets (threat actors) from an OpenCTI instance via the
STIX2 API and normalises them to the canonical ThreatActorData schema.

Feature-flagged: skips gracefully if OPENCTI_URL or OPENCTI_API_KEY is not set.

Environment variables:
    OPENCTI_URL        - Base URL of the OpenCTI instance, e.g. https://opencti.example.com
    OPENCTI_API_KEY    - OpenCTI user API key (read-only)
    OPENCTI_VERIFY_SSL - Set to "false" to disable SSL verification (default: true)
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Path setup
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

OPENCTI_URL = os.environ.get("OPENCTI_URL", "").rstrip("/")
OPENCTI_API_KEY = os.environ.get("OPENCTI_API_KEY", "")
OPENCTI_VERIFY_SSL = os.environ.get("OPENCTI_VERIFY_SSL", "true").lower() != "false"

# OpenCTI GraphQL pagination
_PAGE_SIZE = 50

# ---------------------------------------------------------------------------
# Country code mapping
# ---------------------------------------------------------------------------

_COUNTRY_CODE_MAP: dict[str, str] = {
    "russia": "RU",
    "china": "CN",
    "north korea": "KP",
    "iran": "IR",
    "united states": "US",
    "united states of america": "US",
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
    return _SLUG_RE.sub("-", name.lower()).strip("-")


# ---------------------------------------------------------------------------
# GraphQL query
# ---------------------------------------------------------------------------

_INTRUSION_SETS_QUERY = """
query IntrusionSets($after: ID, $first: Int!) {
  intrusionSets(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        description
        aliases
        first_seen
        last_seen
        primary_motivation
        secondary_motivations
        sophistication
        goals
        resource_level
        objectLabel {
          edges {
            node {
              value
            }
          }
        }
        killChainPhases {
          kill_chain_name
          phase_name
        }
      }
    }
  }
}
"""

# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------


def _extract_motivation(primary: str | None, secondary: list[str]) -> list[str]:
    """Map OpenCTI motivation strings to ThreatDex motivation enum."""
    valid = {"espionage", "financial", "sabotage", "hacktivism", "military"}

    def _map(raw: str) -> str | None:
        r = raw.lower()
        if "coercive" in r or "espionage" in r or "intelligence" in r:
            return "espionage"
        if "financial" in r or "personal-gain" in r:
            return "financial"
        if "sabotage" in r or "destructive" in r:
            return "sabotage"
        if "ideology" in r or "dominance" in r:
            return "hacktivism"
        if "military" in r:
            return "military"
        if r in valid:
            return r
        return None

    result: list[str] = []
    for m in ([primary] if primary else []) + (secondary or []):
        mapped = _map(m)
        if mapped and mapped not in result:
            result.append(mapped)

    return result or ["espionage"]


def _extract_sophistication(raw: str | None) -> str:
    """Map OpenCTI sophistication to ThreatDex enum."""
    if not raw:
        return "Low"
    r = raw.lower()
    if "advanced" in r or "innovative" in r or "strategic" in r:
        return "Nation-State Elite"
    if "expert" in r:
        return "Very High"
    if "practitioner" in r or "intermediate" in r:
        return "High"
    if "opportunistic" in r or "minimal" in r:
        return "Low"
    return "Medium"


def _extract_country_from_labels(labels: list[str]) -> tuple[str | None, str | None]:
    """Try to derive country info from ObjectLabel values."""
    for label in labels:
        code = _COUNTRY_CODE_MAP.get(label.lower())
        if code:
            return label, code
    return None, None


def _year_from_iso(iso: str | None) -> str | None:
    """Extract 4-digit year string from an ISO 8601 timestamp or None."""
    if not iso:
        return None
    return iso[:4] if len(iso) >= 4 else None


# ---------------------------------------------------------------------------
# Node normalisation
# ---------------------------------------------------------------------------


def normalise_node(node: dict[str, Any]) -> ThreatActorData | None:
    """Convert an OpenCTI IntrusionSet GraphQL node to ThreatActorData.

    Parameters
    ----------
    node:
        OpenCTI IntrusionSet node dict from GraphQL response.

    Returns
    -------
    ThreatActorData | None
        Normalised actor, or None if processing fails.
    """
    try:
        name: str = node.get("name") or ""
        if not name:
            return None

        description: str = node.get("description") or ""
        octi_id: str = node.get("id") or ""

        aliases: list[str] = [
            a for a in (node.get("aliases") or []) if a and a != name
        ]
        aliases = list(dict.fromkeys(aliases))

        # Labels (ObjectLabel)
        label_nodes = node.get("objectLabel", {}).get("edges") or []
        labels = [e["node"]["value"] for e in label_nodes if e.get("node", {}).get("value")]

        country, country_code = _extract_country_from_labels(labels)

        motivation = _extract_motivation(
            node.get("primary_motivation"),
            node.get("secondary_motivations") or [],
        )

        sophistication = _extract_sophistication(node.get("sophistication"))
        first_seen = _year_from_iso(node.get("first_seen"))
        last_seen = _year_from_iso(node.get("last_seen"))

        actor_id = _to_slug(name)

        sources = [
            SourceAttribution(
                source="opencti",
                fetched_at=datetime.now(timezone.utc).isoformat(),
                source_id=octi_id,
                url=f"{OPENCTI_URL}/dashboard/threats/intrusion_sets/{octi_id}"
                if octi_id
                else None,
            )
        ]

        threat_level = compute_threat_level(sophistication, 0, 0)
        rarity = compute_rarity(threat_level, sophistication, len(sources))

        return ThreatActorData(
            id=actor_id,
            canonical_name=name,
            description=description,
            aliases=aliases,
            country=country,
            country_code=country_code,
            motivation=motivation,
            threat_level=threat_level,
            sophistication=sophistication,
            first_seen=first_seen,
            last_seen=last_seen,
            rarity=rarity,
            sources=sources,
            tlp="WHITE",
        )

    except Exception:
        logger.error(
            "Failed to normalise OpenCTI node: %s", node.get("name"), exc_info=True
        )
        return None


# ---------------------------------------------------------------------------
# API client — GraphQL
# ---------------------------------------------------------------------------


def fetch_intrusion_sets(
    opencti_url: str = OPENCTI_URL,
    api_key: str = OPENCTI_API_KEY,
    verify_ssl: bool = OPENCTI_VERIFY_SSL,
) -> list[dict[str, Any]]:
    """Fetch all intrusion sets from OpenCTI via GraphQL pagination.

    Parameters
    ----------
    opencti_url:
        Base URL of the OpenCTI instance.
    api_key:
        OpenCTI user API key.
    verify_ssl:
        Whether to verify the server SSL certificate.

    Returns
    -------
    list[dict]
        List of raw IntrusionSet node dicts.
    """
    if not _REQUESTS_AVAILABLE or _requests is None:
        logger.error("requests library is not available")
        return []

    endpoint = f"{opencti_url}/graphql"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    nodes: list[dict[str, Any]] = []
    cursor: str | None = None
    page = 0

    while True:
        variables: dict[str, Any] = {"first": _PAGE_SIZE}
        if cursor:
            variables["after"] = cursor

        try:
            resp = _requests.post(
                endpoint,
                json={"query": _INTRUSION_SETS_QUERY, "variables": variables},
                headers=headers,
                verify=verify_ssl,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            if "errors" in data:
                logger.error("GraphQL errors: %s", data["errors"])
                break

            intrusion_sets = data.get("data", {}).get("intrusionSets", {})
            edges = intrusion_sets.get("edges") or []
            page_info = intrusion_sets.get("pageInfo") or {}

            for edge in edges:
                if edge.get("node"):
                    nodes.append(edge["node"])

            page += 1
            logger.debug("Fetched page %d (%d nodes so far)", page, len(nodes))

            if not page_info.get("hasNextPage"):
                break

            cursor = page_info.get("endCursor")
            if not cursor:
                break

        except Exception as exc:
            logger.error("Failed to fetch OpenCTI intrusion sets: %s", exc, exc_info=True)
            break

    logger.info("Fetched %d OpenCTI intrusion set nodes", len(nodes))
    return nodes


# ---------------------------------------------------------------------------
# Main sync function
# ---------------------------------------------------------------------------


def run_sync(
    engine: Any | None = None,
    opencti_url: str = OPENCTI_URL,
    api_key: str = OPENCTI_API_KEY,
) -> int:
    """Run a full OpenCTI sync.

    Feature-flags gracefully if OPENCTI_URL or OPENCTI_API_KEY are not
    configured.

    Parameters
    ----------
    engine:
        Optional SQLAlchemy engine. If None, actors are normalised but not
        persisted (useful for testing).
    opencti_url:
        Override for the OpenCTI URL.
    api_key:
        Override for the OpenCTI API key.

    Returns
    -------
    int
        Number of actors successfully ingested.
    """
    if not opencti_url:
        logger.warning("OPENCTI_URL not configured — skipping OpenCTI sync")
        return 0
    if not api_key:
        logger.warning("OPENCTI_API_KEY not configured — skipping OpenCTI sync")
        return 0

    nodes = fetch_intrusion_sets(opencti_url, api_key)
    if not nodes:
        logger.info("No OpenCTI intrusion sets returned")
        return 0

    actors: list[ThreatActorData] = []
    for node in nodes:
        actor = normalise_node(node)
        if actor:
            actors.append(actor)

    logger.info(
        "Normalised %d / %d OpenCTI nodes to ThreatActorData", len(actors), len(nodes)
    )

    if engine is None:
        return len(actors)

    try:
        from shared.db import upsert_actors

        upsert_actors(engine, actors, source="opencti")
        logger.info("Upserted %d OpenCTI actors to database", len(actors))
    except Exception as exc:
        logger.error("Failed to upsert OpenCTI actors: %s", exc, exc_info=True)
        return 0

    return len(actors)
