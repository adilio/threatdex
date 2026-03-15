"""
AlienVault OTX connector.

Feature-flagged: skips gracefully if OTX_API_KEY env var is not set.
Uses the OTX DirectConnect API to fetch threat actor pulses tagged with
"apt" or "threat-actor" and normalises them into ThreatActorData records.

API reference: https://otx.alienvault.com/api/v1/

Usage:
    OTX_API_KEY=<key> python -m otx_sync.sync
    OTX_API_KEY=<key> python sync.py
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any

import requests
from slugify import slugify

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
_WORKERS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

from shared.db import get_engine, log_sync_complete, log_sync_error, log_sync_start, upsert_actor
from shared.dedup import find_matching_actor, merge_actors
from shared.models import Campaign, SourceAttribution, ThreatActorData, TTPUsage
from shared.rarity import compute_rarity, compute_threat_level

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OTX_API_BASE = "https://otx.alienvault.com/api/v1"
OTX_PULSE_ENDPOINT = f"{OTX_API_BASE}/pulses/subscribed"
OTX_SEARCH_ENDPOINT = f"{OTX_API_BASE}/search/pulses"

# Tags that indicate a pulse is about a threat actor rather than an IoC feed
THREAT_ACTOR_TAGS = {"apt", "threat-actor", "threat actor", "intrusion-set", "nation-state"}

PAGE_SIZE = 50  # OTX max page size

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_api_key() -> str | None:
    """Return the OTX API key from the environment, or None if absent."""
    return os.environ.get("OTX_API_KEY") or None


def _is_threat_actor_pulse(pulse: dict[str, Any]) -> bool:
    """Return True if the pulse appears to represent a threat-actor group."""
    tags: list[str] = [t.lower() for t in pulse.get("tags", [])]
    return bool(THREAT_ACTOR_TAGS.intersection(tags))


def _clean_pulse_name(name: str) -> str:
    """Strip common noise from OTX pulse names to get a candidate actor name.

    Examples:
      "APT28 - Fancy Bear Campaign 2023" → "APT28"
      "Threat Actor: Lazarus Group"       → "Lazarus Group"
    """
    # Remove trailing date / campaign noise
    name = re.sub(r"\s*[-–—:]\s*(campaign|operation|activity|ioc|indicator).*$", "", name, flags=re.IGNORECASE)
    # Remove leading "Threat Actor:" / "APT Group:" prefixes
    name = re.sub(r"^(threat\s+actor|apt\s+group|group|actor)\s*:\s*", "", name, flags=re.IGNORECASE)
    return name.strip()


def _extract_year(date_str: str | None) -> str | None:
    """Extract YYYY from an ISO-8601 or similar date string."""
    if not date_str:
        return None
    m = re.match(r"(\d{4})", date_str)
    return m.group(1) if m else None


def _map_attack_ids(attack_ids: list[dict[str, Any]]) -> list[TTPUsage]:
    """Convert OTX ATT&CK ID entries to TTPUsage objects."""
    ttps: list[TTPUsage] = []
    seen: set[str] = set()
    for entry in attack_ids:
        tid = entry.get("id", "").strip()
        if not tid or tid in seen:
            continue
        seen.add(tid)
        ttps.append(
            TTPUsage(
                technique_id=tid,
                technique_name=entry.get("display_name", ""),
                tactic=entry.get("tactic", ""),
            )
        )
    return ttps


def _indicators_to_tools(indicators: list[dict[str, Any]]) -> list[str]:
    """Extract hostname/domain indicators as potential C2 infrastructure clues.

    Rather than using raw hostnames as tool names, this function returns
    the unique domain roots — they serve as context for what infrastructure
    the actor controls.
    """
    seen: set[str] = set()
    tools: list[str] = []
    for ind in indicators:
        itype = ind.get("type", "").lower()
        if itype in ("hostname", "domain", "url"):
            value: str = ind.get("indicator", "")
            if value and value not in seen:
                seen.add(value)
                tools.append(value)
    return tools


# ---------------------------------------------------------------------------
# OTX API client
# ---------------------------------------------------------------------------


class OTXClient:
    """Minimal OTX DirectConnect API client."""

    def __init__(self, api_key: str) -> None:
        self._session = requests.Session()
        self._session.headers.update(
            {
                "X-OTX-API-KEY": api_key,
                "User-Agent": "ThreatDex-Sync/1.0",
            }
        )

    def get_subscribed_pulses(self, page: int = 1, limit: int = PAGE_SIZE) -> dict[str, Any]:
        """Fetch a page of subscribed pulses."""
        response = self._session.get(
            OTX_PULSE_ENDPOINT,
            params={"limit": limit, "page": page},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def search_threat_actor_pulses(self, page: int = 1, limit: int = PAGE_SIZE) -> dict[str, Any]:
        """Search for pulses tagged with threat actor tags."""
        response = self._session.get(
            OTX_SEARCH_ENDPOINT,
            params={"q": "threat-actor", "limit": limit, "page": page},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_pulse_details(self, pulse_id: str) -> dict[str, Any]:
        """Fetch full details for a single pulse including indicators."""
        response = self._session.get(
            f"{OTX_API_BASE}/pulses/{pulse_id}",
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


# ---------------------------------------------------------------------------
# Pulse → ThreatActorData conversion
# ---------------------------------------------------------------------------


def parse_pulse(pulse: dict[str, Any]) -> ThreatActorData | None:
    """Convert an OTX pulse dict to a ThreatActorData record.

    Parameters
    ----------
    pulse:
        A single pulse object from the OTX API response.

    Returns
    -------
    ThreatActorData | None
        Normalised actor, or None if the pulse cannot be meaningfully mapped.
    """
    name: str = _clean_pulse_name(pulse.get("name", ""))
    if not name:
        return None

    description: str = pulse.get("description", "") or ""
    tags: list[str] = pulse.get("tags", [])
    indicators: list[dict] = pulse.get("indicators", [])
    attack_ids: list[dict] = pulse.get("attack_ids", [])
    pulse_id: str = pulse.get("id", "")
    created: str = pulse.get("created", "")
    modified: str = pulse.get("modified", "")

    # Treat each unique pulse as a campaign
    campaigns: list[Campaign] = [
        Campaign(
            name=pulse.get("name", name),
            year=_extract_year(created),
            description=description[:300] if description else "",
        )
    ]

    ttps = _map_attack_ids(attack_ids)
    tools = _indicators_to_tools(indicators)

    # Infer motivation from tags and description
    motivation: list[str] = []
    combined_text = " ".join(tags).lower() + " " + description.lower()
    motivation_map = {
        "espionage": "espionage",
        "financial": "financial",
        "sabotage": "sabotage",
        "hacktivism": "hacktivism",
        "military": "military",
    }
    for keyword, value in motivation_map.items():
        if keyword in combined_text and value not in motivation:
            motivation.append(value)
    if not motivation:
        motivation = ["espionage"]

    sophistication = "High"  # OTX actor pulses are typically about notable groups

    threat_level = compute_threat_level(
        sophistication=sophistication,
        ttps_count=len(ttps),
        campaigns_count=len(campaigns),
    )
    sources = [
        SourceAttribution(
            source="otx",
            source_id=pulse_id,
            fetched_at=_now_iso(),
            url=f"https://otx.alienvault.com/pulse/{pulse_id}" if pulse_id else None,
        )
    ]
    rarity = compute_rarity(
        threat_level=threat_level,
        sophistication=sophistication,
        sources_count=len(sources),
    )

    return ThreatActorData(
        id=slugify(name, separator="-", lowercase=True),
        canonical_name=name,
        aliases=[],
        motivation=motivation,
        threat_level=threat_level,
        sophistication=sophistication,
        first_seen=_extract_year(created),
        last_seen=_extract_year(modified),
        sectors=[],
        geographies=[],
        tools=tools,
        ttps=ttps,
        campaigns=campaigns,
        description=description,
        rarity=rarity,
        sources=sources,
        tlp="WHITE",
        last_updated=_now_iso(),
    )


def _iter_threat_actor_pulses(client: OTXClient):
    """Yield all threat-actor pulses from OTX, paginating automatically.

    Parameters
    ----------
    client:
        Authenticated OTXClient.

    Yields
    ------
    dict
        Individual pulse objects.
    """
    page = 1
    total_fetched = 0

    while True:
        try:
            data = client.get_subscribed_pulses(page=page, limit=PAGE_SIZE)
        except requests.RequestException as exc:
            logger.error("OTX API request failed on page %d: %s", page, exc)
            break

        results: list[dict] = data.get("results", [])
        if not results:
            break

        for pulse in results:
            if _is_threat_actor_pulse(pulse):
                yield pulse
                total_fetched += 1

        # OTX uses a "next" cursor field when more pages exist
        if not data.get("next"):
            break
        page += 1

    logger.info("Fetched %d threat-actor pulses from OTX", total_fetched)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Fetch OTX threat-actor pulses and upsert them into the DB.

    Skips gracefully if OTX_API_KEY is not configured.
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning(
            "OTX_API_KEY environment variable is not set — skipping OTX sync. "
            "Set OTX_API_KEY to enable this connector."
        )
        return

    engine = get_engine()
    log_id = log_sync_start(engine, "otx")
    records_synced = 0

    try:
        client = OTXClient(api_key)

        for pulse in _iter_threat_actor_pulses(client):
            try:
                actor = parse_pulse(pulse)
                if actor is None:
                    continue

                existing_id = find_matching_actor(engine, actor)
                if existing_id and existing_id != actor.id:
                    from sqlalchemy import text as _text
                    import json as _json
                    with engine.connect() as conn:
                        row = conn.execute(
                            _text("SELECT row_to_json(t) FROM threat_actors t WHERE id = :id"),
                            {"id": existing_id},
                        ).fetchone()
                    if row:
                        existing_dict = _json.loads(row[0]) if isinstance(row[0], str) else row[0]
                        actor = merge_actors(existing_dict, actor)

                upsert_actor(engine, actor)
                records_synced += 1

            except Exception:
                logger.warning(
                    "Failed to process pulse %s — skipping",
                    pulse.get("id", "unknown"),
                    exc_info=True,
                )

        log_sync_complete(engine, log_id, records_synced)
        logger.info("OTX sync complete — %d actors upserted", records_synced)

    except Exception as exc:
        log_sync_error(engine, log_id, str(exc))
        logger.error("OTX sync failed: %s", exc, exc_info=True)
        raise


if __name__ == "__main__":
    main()
