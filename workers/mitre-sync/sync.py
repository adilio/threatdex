"""
MITRE ATT&CK TAXII 2.1 ingestion worker.

Pulls intrusion-set objects from the MITRE ATT&CK STIX bundle hosted at:
  https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json

This approach is more reliable than live TAXII queries in CI/CD environments
because it does not require authentication and is served from a CDN.

Usage:
    python -m mitre_sync.sync        # as a module
    python sync.py                   # directly
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
# Path setup — allow running as a standalone script from this directory
# ---------------------------------------------------------------------------
_WORKERS_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _WORKERS_ROOT not in sys.path:
    sys.path.insert(0, _WORKERS_ROOT)

from shared.db import get_engine, log_sync_complete, log_sync_error, log_sync_start, upsert_actor  # noqa: E402
from shared.dedup import find_matching_actor, merge_actors  # noqa: E402
from shared.models import Campaign, SourceAttribution, ThreatActorData, TTPUsage  # noqa: E402
from shared.rarity import compute_rarity, compute_threat_level  # noqa: E402

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STIX_BUNDLE_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/"
    "enterprise-attack/enterprise-attack.json"
)

MITRE_ATTACK_BASE_URL = "https://attack.mitre.org/groups/"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Motivation mapping
# ---------------------------------------------------------------------------

_MOTIVATION_MAP: dict[str, str] = {
    "espionage": "espionage",
    "cyber espionage": "espionage",
    "state-sponsored": "espionage",
    "financial gain": "financial",
    "financial": "financial",
    "sabotage": "sabotage",
    "destruction": "sabotage",
    "disruption": "sabotage",
    "hacktivism": "hacktivism",
    "ideology": "hacktivism",
    "military advantage": "military",
    "military": "military",
}

_SOPHISTICATION_MAP: dict[str, str] = {
    "none": "Low",
    "minimal": "Low",
    "intermediate": "Medium",
    "advanced": "High",
    "expert": "Very High",
    "innovator": "Nation-State Elite",
    "strategic": "Nation-State Elite",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify_actor(name: str) -> str:
    """Return a URL-safe slug for a threat-actor name."""
    return slugify(name, separator="-", lowercase=True)


def _map_motivation(raw_values: list[str]) -> list[str]:
    """Convert MITRE motivation strings to ThreatDex motivation enum values."""
    result: list[str] = []
    for v in raw_values:
        mapped = _MOTIVATION_MAP.get(v.lower().strip())
        if mapped and mapped not in result:
            result.append(mapped)
    return result or ["espionage"]  # default for nation-state actors


def _map_sophistication(raw: str | None) -> str:
    if not raw:
        return "High"  # MITRE actors are generally sophisticated
    return _SOPHISTICATION_MAP.get(raw.lower().strip(), "High")


def _extract_mitre_id(external_refs: list[dict[str, Any]]) -> str | None:
    for ref in external_refs:
        if ref.get("source_name") == "mitre-attack":
            return ref.get("external_id")
    return None


def _extract_mitre_url(external_refs: list[dict[str, Any]]) -> str | None:
    for ref in external_refs:
        if ref.get("source_name") == "mitre-attack":
            ext_id = ref.get("external_id", "")
            if ext_id:
                return f"{MITRE_ATTACK_BASE_URL}{ext_id}/"
    return None


def _extract_year(stix_timestamp: str | None) -> str | None:
    """Extract YYYY from a STIX timestamp string."""
    if not stix_timestamp:
        return None
    match = re.match(r"(\d{4})", stix_timestamp)
    return match.group(1) if match else None


def _infer_country_from_labels(labels: list[str], description: str) -> tuple[str | None, str | None]:
    """Attempt to infer country/country_code from labels or description text.

    Returns (country_name, iso_alpha2) or (None, None) if uncertain.
    """
    country_hints: dict[str, tuple[str, str]] = {
        "russia": ("Russia", "RU"),
        "russian": ("Russia", "RU"),
        "china": ("China", "CN"),
        "chinese": ("China", "CN"),
        "iran": ("Iran", "IR"),
        "iranian": ("Iran", "IR"),
        "north korea": ("North Korea", "KP"),
        "dprk": ("North Korea", "KP"),
        "lazarus": ("North Korea", "KP"),
        "vietnam": ("Vietnam", "VN"),
        "vietnamese": ("Vietnam", "VN"),
        "india": ("India", "IN"),
        "pakistan": ("Pakistan", "PK"),
        "turkey": ("Turkey", "TR"),
        "turkish": ("Turkey", "TR"),
        "israel": ("Israel", "IL"),
        "united states": ("United States", "US"),
        "united kingdom": ("United Kingdom", "GB"),
    }
    text_to_search = " ".join(labels).lower() + " " + description.lower()
    for hint, (country, code) in country_hints.items():
        if hint in text_to_search:
            return country, code
    return None, None


# ---------------------------------------------------------------------------
# STIX bundle parsing
# ---------------------------------------------------------------------------


def fetch_stix_bundle(url: str = STIX_BUNDLE_URL) -> dict[str, Any]:
    """Download and return the MITRE ATT&CK STIX bundle as a dict.

    Parameters
    ----------
    url:
        URL of the STIX JSON bundle. Defaults to the GitHub-hosted file.

    Returns
    -------
    dict
        Parsed JSON bundle.

    Raises
    ------
    requests.HTTPError
        If the HTTP request fails.
    """
    logger.info("Fetching STIX bundle from %s", url)
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    bundle = response.json()
    logger.info(
        "Fetched STIX bundle — %d objects total",
        len(bundle.get("objects", [])),
    )
    return bundle


def _index_bundle(
    objects: list[dict[str, Any]],
) -> tuple[
    dict[str, dict[str, Any]],      # all objects by STIX ID
    list[dict[str, Any]],           # intrusion-set objects
    dict[str, list[dict[str, Any]]],# relationships by source_ref
    dict[str, list[dict[str, Any]]],# relationships by target_ref
]:
    """Build lookup indexes from a flat STIX objects list."""
    by_id: dict[str, dict[str, Any]] = {}
    intrusion_sets: list[dict[str, Any]] = []
    rels_by_source: dict[str, list[dict[str, Any]]] = {}
    rels_by_target: dict[str, list[dict[str, Any]]] = {}

    for obj in objects:
        stix_id = obj.get("id", "")
        by_id[stix_id] = obj

        if obj.get("type") == "intrusion-set":
            intrusion_sets.append(obj)

        if obj.get("type") == "relationship":
            src = obj.get("source_ref", "")
            tgt = obj.get("target_ref", "")
            rels_by_source.setdefault(src, []).append(obj)
            rels_by_target.setdefault(tgt, []).append(obj)

    return by_id, intrusion_sets, rels_by_source, rels_by_target


def parse_intrusion_set(
    obj: dict[str, Any],
    by_id: dict[str, dict[str, Any]],
    rels_by_source: dict[str, list[dict[str, Any]]],
    rels_by_target: dict[str, list[dict[str, Any]]],
) -> ThreatActorData:
    """Convert a single STIX intrusion-set object to ThreatActorData.

    Parameters
    ----------
    obj:
        The STIX intrusion-set dict.
    by_id:
        All STIX objects indexed by their STIX ID.
    rels_by_source:
        Relationship objects indexed by ``source_ref``.
    rels_by_target:
        Relationship objects indexed by ``target_ref``.

    Returns
    -------
    ThreatActorData
        Normalised actor record.
    """
    stix_id = obj.get("id", "")
    name: str = obj.get("name", "Unknown")
    description: str = obj.get("description", "")
    labels: list[str] = obj.get("labels", [])
    external_refs: list[dict] = obj.get("external_references", [])
    aliases: list[str] = [
        a for a in obj.get("aliases", obj.get("x_mitre_aliases", []))
        if a and a != name
    ]

    mitre_id = _extract_mitre_id(external_refs)
    mitre_url = _extract_mitre_url(external_refs)

    sophistication_raw = obj.get("x_mitre_version") or obj.get("sophistication")
    sophistication = _map_sophistication(sophistication_raw)

    raw_motivations: list[str] = (
        obj.get("x_mitre_motivation_types")
        or obj.get("primary_motivation_types")
        or []
    )
    motivation = _map_motivation(raw_motivations)

    first_seen = _extract_year(obj.get("first_seen") or obj.get("created"))
    last_seen = _extract_year(obj.get("last_seen") or obj.get("modified"))

    sectors: list[str] = obj.get("x_mitre_sectors") or []
    country, country_code = _infer_country_from_labels(labels, description)

    # --- TTPs: "uses" relationships where target is attack-pattern ----------
    ttps: list[TTPUsage] = []
    for rel in rels_by_source.get(stix_id, []):
        if rel.get("relationship_type") != "uses":
            continue
        target = by_id.get(rel.get("target_ref", ""))
        if not target or target.get("type") != "attack-pattern":
            continue
        technique_id = _extract_mitre_id(target.get("external_references", []))
        if not technique_id:
            continue
        tactic = ""
        kill_chain_phases = target.get("kill_chain_phases", [])
        if kill_chain_phases:
            tactic = kill_chain_phases[0].get("phase_name", "")
        ttps.append(
            TTPUsage(
                technique_id=technique_id,
                technique_name=target.get("name", ""),
                tactic=tactic,
            )
        )

    # --- Tools: "uses" relationships where target is tool/malware -----------
    tools: list[str] = []
    for rel in rels_by_source.get(stix_id, []):
        if rel.get("relationship_type") != "uses":
            continue
        target = by_id.get(rel.get("target_ref", ""))
        if not target:
            continue
        if target.get("type") in ("tool", "malware"):
            tool_name = target.get("name")
            if tool_name and tool_name not in tools:
                tools.append(tool_name)

    # --- Campaigns: attributed-to or member-of relationships ----------------
    campaigns: list[Campaign] = []
    for rel in rels_by_target.get(stix_id, []):
        if rel.get("relationship_type") not in ("attributed-to", "targets"):
            continue
        src_obj = by_id.get(rel.get("source_ref", ""))
        if not src_obj or src_obj.get("type") != "campaign":
            continue
        camp_year = _extract_year(src_obj.get("first_seen") or src_obj.get("created"))
        campaigns.append(
            Campaign(
                name=src_obj.get("name", "Unknown Campaign"),
                year=camp_year,
                description=src_obj.get("description", ""),
            )
        )

    threat_level = compute_threat_level(
        sophistication=sophistication,
        ttps_count=len(ttps),
        campaigns_count=len(campaigns),
    )
    sources = [
        SourceAttribution(
            source="mitre",
            source_id=mitre_id,
            fetched_at=_now_iso(),
            url=mitre_url,
        )
    ]
    rarity = compute_rarity(
        threat_level=threat_level,
        sophistication=sophistication,
        sources_count=len(sources),
    )

    return ThreatActorData(
        id=_slugify_actor(name),
        canonical_name=name,
        aliases=aliases,
        mitre_id=mitre_id,
        country=country,
        country_code=country_code,
        motivation=motivation,
        threat_level=threat_level,
        sophistication=sophistication,
        first_seen=first_seen,
        last_seen=last_seen,
        sectors=sectors,
        geographies=[],
        tools=tools,
        ttps=ttps,
        campaigns=campaigns,
        description=description,
        tagline=None,
        rarity=rarity,
        image_url=None,
        image_prompt=None,
        sources=sources,
        tlp="WHITE",
        last_updated=_now_iso(),
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def main(bundle_url: str = STIX_BUNDLE_URL) -> None:
    """Fetch the MITRE ATT&CK STIX bundle and upsert all intrusion-set actors.

    Parameters
    ----------
    bundle_url:
        Override the STIX bundle URL (useful for testing).
    """
    engine = get_engine()
    log_id = log_sync_start(engine, "mitre")
    records_synced = 0

    try:
        bundle = fetch_stix_bundle(bundle_url)
        objects: list[dict[str, Any]] = bundle.get("objects", [])

        by_id, intrusion_sets, rels_by_source, rels_by_target = _index_bundle(objects)
        logger.info("Found %d intrusion-set objects", len(intrusion_sets))

        for obj in intrusion_sets:
            try:
                actor = parse_intrusion_set(obj, by_id, rels_by_source, rels_by_target)

                existing_id = find_matching_actor(engine, actor)
                if existing_id and existing_id != actor.id:
                    # Load existing record and merge
                    from sqlalchemy import text as _text
                    with engine.connect() as conn:
                        row = conn.execute(
                            _text("SELECT row_to_json(t) FROM threat_actors t WHERE id = :id"),
                            {"id": existing_id},
                        ).fetchone()
                    if row:
                        import json as _json
                        existing_dict = _json.loads(row[0]) if isinstance(row[0], str) else row[0]
                        actor = merge_actors(existing_dict, actor)

                upsert_actor(engine, actor)
                records_synced += 1

            except Exception:
                logger.warning(
                    "Failed to process intrusion-set %s — skipping",
                    obj.get("name", obj.get("id")),
                    exc_info=True,
                )

        log_sync_complete(engine, log_id, records_synced)
        logger.info("MITRE sync complete — %d actors upserted", records_synced)

    except Exception as exc:
        log_sync_error(engine, log_id, str(exc))
        logger.error("MITRE sync failed: %s", exc, exc_info=True)
        raise


if __name__ == "__main__":
    main()
