"""
Deduplication and merge logic for ThreatDex actors.

Provides:
- normalize_name()      — canonical string form for name matching
- find_matching_actor() — look up an existing actor by name / alias
- merge_actors()        — combine existing DB record with new ingest data
"""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

from .models import Campaign, SourceAttribution, ThreatActorData, TTPUsage

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Name normalisation
# ---------------------------------------------------------------------------

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE_RE = re.compile(r"\s+")

# Common prefixes that should be stripped before comparison so that
# "APT28", "apt 28", and "Group 28" can all match.
_STRIP_PREFIXES = re.compile(
    r"^(apt|group|threat group|ta|unc|fin|g)\s*",
    re.IGNORECASE,
)


def normalize_name(name: str) -> str:
    """Return a canonical lowercase form of *name* for fuzzy matching.

    Steps:
    1. Unicode NFKC normalisation (homoglyph collapse).
    2. Lowercase.
    3. Strip leading/trailing whitespace.
    4. Remove all punctuation characters.
    5. Collapse multiple spaces to one.
    6. Strip common threat-actor name prefixes (APT, TA, FIN, …).

    Parameters
    ----------
    name:
        Raw threat-actor name or alias.

    Returns
    -------
    str
        Normalised string, e.g. ``"apt 28"`` → ``"28"``.
    """
    normalised = unicodedata.normalize("NFKC", name)
    normalised = normalised.lower().strip()
    normalised = _PUNCT_RE.sub("", normalised)
    normalised = _SPACE_RE.sub(" ", normalised).strip()
    normalised = _STRIP_PREFIXES.sub("", normalised).strip()
    return normalised


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------


def find_matching_actor(engine: Engine, actor: ThreatActorData) -> str | None:
    """Return the existing actor ID if a matching record is found in the DB.

    Matching strategy (in order):
    1. Exact slug match on ``id``.
    2. Case-insensitive match on ``canonical_name``.
    3. Normalised name match against canonical names.
    4. Normalised name match against any element of the ``aliases`` JSONB array.

    Parameters
    ----------
    engine:
        SQLAlchemy engine for the ThreatDex database.
    actor:
        Incoming actor data to look up.

    Returns
    -------
    str | None
        The existing actor's ``id`` (slug) if found, otherwise ``None``.
    """
    candidate_names = [actor.canonical_name] + actor.aliases
    normalised_candidates = {normalize_name(n) for n in candidate_names if n}

    try:
        with engine.connect() as conn:
            # 1. Exact slug match
            row = conn.execute(
                text("SELECT id FROM threat_actors WHERE id = :id"),
                {"id": actor.id},
            ).fetchone()
            if row:
                logger.debug("Matched actor by slug: %s", actor.id)
                return row[0]

            # 2 & 3. Case-insensitive / normalised canonical name match
            rows = conn.execute(
                text("SELECT id, canonical_name FROM threat_actors")
            ).fetchall()

            for db_id, db_name in rows:
                if db_name and normalize_name(db_name) in normalised_candidates:
                    logger.debug(
                        "Matched actor by canonical name: %s → %s", actor.id, db_id
                    )
                    return db_id

            # 4. Match against aliases stored in JSONB
            alias_rows = conn.execute(
                text(
                    """
                    SELECT id, alias_value
                    FROM threat_actors,
                         jsonb_array_elements_text(aliases) AS alias_value
                    """
                )
            ).fetchall()

            for db_id, alias in alias_rows:
                if alias and normalize_name(alias) in normalised_candidates:
                    logger.debug(
                        "Matched actor by alias: %s → %s", actor.id, db_id
                    )
                    return db_id

    except Exception:
        logger.warning(
            "find_matching_actor failed for %s — treating as new actor",
            actor.id,
            exc_info=True,
        )

    return None


# ---------------------------------------------------------------------------
# Merging
# ---------------------------------------------------------------------------


def _union_list(existing: list[Any], incoming: list[Any]) -> list[Any]:
    """Return the union of two lists, preserving order and deduplicating."""
    seen: set[Any] = set()
    result: list[Any] = []
    for item in existing + incoming:
        key = str(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _union_ttps(existing: list[TTPUsage], incoming: list[TTPUsage]) -> list[TTPUsage]:
    seen: set[str] = set()
    result: list[TTPUsage] = []
    for ttp in existing + incoming:
        if ttp.technique_id not in seen:
            seen.add(ttp.technique_id)
            result.append(ttp)
    return result


def _union_campaigns(
    existing: list[Campaign], incoming: list[Campaign]
) -> list[Campaign]:
    seen: set[str] = {c.name.lower() for c in existing}
    result: list[Campaign] = list(existing)
    for c in incoming:
        if c.name.lower() not in seen:
            seen.add(c.name.lower())
            result.append(c)
    return result


def _union_sources(
    existing: list[SourceAttribution], incoming: list[SourceAttribution]
) -> list[SourceAttribution]:
    """Merge source lists, updating fetched_at for existing sources."""
    by_source: dict[str, SourceAttribution] = {s.source: s for s in existing}
    for s in incoming:
        by_source[s.source] = s  # always take the fresher record
    return list(by_source.values())


def _coalesce(*values: Any) -> Any:
    """Return the first non-None, non-empty value."""
    for v in values:
        if v is not None and v != "" and v != []:
            return v
    return values[-1]


def merge_actors(existing: dict[str, Any], new: ThreatActorData) -> ThreatActorData:
    """Merge an existing DB actor record with freshly ingested data.

    Strategy:
    - Scalar fields: keep the new value when non-None/non-empty, otherwise fall
      back to the existing value.
    - List fields (aliases, sectors, geographies, tools): union.
    - TTPs: union by technique_id.
    - Campaigns: union by campaign name (case-insensitive).
    - Sources: merge by source key, always taking the fresher record.
    - threat_level: take the maximum.
    - last_updated: always use current UTC timestamp.

    Parameters
    ----------
    existing:
        Raw dict as stored in (or fetched from) the database.
    new:
        Freshly ingested ThreatActorData.

    Returns
    -------
    ThreatActorData
        Merged actor ready for upsert.
    """
    # Reconstruct nested objects from the existing dict so we can union them.
    existing_ttps = [
        TTPUsage(
            technique_id=t["technique_id"],
            technique_name=t["technique_name"],
            tactic=t["tactic"],
        )
        for t in (existing.get("ttps") or [])
    ]
    existing_campaigns = [
        Campaign(
            name=c["name"],
            description=c.get("description", ""),
            year=c.get("year"),
        )
        for c in (existing.get("campaigns") or [])
    ]
    existing_sources = [
        SourceAttribution(
            source=s["source"],
            fetched_at=s["fetched_at"],
            source_id=s.get("source_id"),
            url=s.get("url"),
        )
        for s in (existing.get("sources") or [])
    ]

    merged = ThreatActorData(
        id=existing.get("id") or new.id,
        canonical_name=_coalesce(existing.get("canonical_name"), new.canonical_name),
        description=_coalesce(new.description, existing.get("description", "")),
        aliases=_union_list(
            existing.get("aliases") or [], new.aliases
        ),
        mitre_id=_coalesce(new.mitre_id, existing.get("mitre_id")),
        country=_coalesce(new.country, existing.get("country")),
        country_code=_coalesce(new.country_code, existing.get("country_code")),
        motivation=_union_list(
            existing.get("motivation") or [], new.motivation
        ),
        threat_level=max(
            existing.get("threat_level") or 1, new.threat_level
        ),
        sophistication=_coalesce(new.sophistication, existing.get("sophistication", "Low")),
        first_seen=_coalesce(new.first_seen, existing.get("first_seen")),
        last_seen=_coalesce(new.last_seen, existing.get("last_seen")),
        sectors=_union_list(
            existing.get("sectors") or [], new.sectors
        ),
        geographies=_union_list(
            existing.get("geographies") or [], new.geographies
        ),
        tools=_union_list(existing.get("tools") or [], new.tools),
        ttps=_union_ttps(existing_ttps, new.ttps),
        campaigns=_union_campaigns(existing_campaigns, new.campaigns),
        tagline=_coalesce(new.tagline, existing.get("tagline")),
        rarity=_coalesce(new.rarity, existing.get("rarity", "RARE")),
        image_url=_coalesce(existing.get("image_url"), new.image_url),
        image_prompt=_coalesce(existing.get("image_prompt"), new.image_prompt),
        sources=_union_sources(existing_sources, new.sources),
        tlp=_coalesce(new.tlp, existing.get("tlp", "WHITE")),
        last_updated=datetime.now(timezone.utc).isoformat(),
    )
    return merged
