"""
Shared Python dataclasses matching the ThreatActor canonical schema.
All ingestion workers produce ThreatActorData instances that are then
persisted via shared/db.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class TTPUsage:
    technique_id: str
    technique_name: str
    tactic: str


@dataclass
class Campaign:
    name: str
    description: str
    year: str | None = None


@dataclass
class SourceAttribution:
    source: str  # "mitre" | "etda" | "otx" | "misp" | "opencti" | "manual"
    fetched_at: str  # ISO 8601
    source_id: str | None = None
    url: str | None = None


@dataclass
class ThreatActorData:
    id: str                            # slug e.g. "apt28"
    canonical_name: str
    description: str
    sources: list[SourceAttribution] = field(default_factory=list)

    aliases: list[str] = field(default_factory=list)
    mitre_id: str | None = None
    country: str | None = None
    country_code: str | None = None    # ISO 3166-1 alpha-2
    motivation: list[str] = field(default_factory=list)
    threat_level: int = 1              # 1–10
    sophistication: str = "Low"        # "Low"|"Medium"|"High"|"Very High"|"Nation-State Elite"
    first_seen: str | None = None      # YYYY
    last_seen: str | None = None       # YYYY
    sectors: list[str] = field(default_factory=list)
    geographies: list[str] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)
    ttps: list[TTPUsage] = field(default_factory=list)
    campaigns: list[Campaign] = field(default_factory=list)
    tagline: str | None = None
    rarity: str = "RARE"               # "MYTHIC"|"LEGENDARY"|"EPIC"|"RARE"
    image_url: str | None = None
    image_prompt: str | None = None
    tlp: str = "WHITE"                 # "WHITE"|"GREEN"
    last_updated: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


def to_db_dict(actor: ThreatActorData) -> dict[str, Any]:
    """Serialize a ThreatActorData to a flat dict suitable for DB upsert.

    List/nested fields are stored as JSON-serialisable Python objects (lists
    of dicts); the DB layer is responsible for encoding them as JSONB columns.
    """
    return {
        "id": actor.id,
        "canonical_name": actor.canonical_name,
        "aliases": actor.aliases,
        "mitre_id": actor.mitre_id,
        "country": actor.country,
        "country_code": actor.country_code,
        "motivation": actor.motivation,
        "threat_level": actor.threat_level,
        "sophistication": actor.sophistication,
        "first_seen": actor.first_seen,
        "last_seen": actor.last_seen,
        "sectors": actor.sectors,
        "geographies": actor.geographies,
        "tools": actor.tools,
        "ttps": [
            {
                "technique_id": t.technique_id,
                "technique_name": t.technique_name,
                "tactic": t.tactic,
            }
            for t in actor.ttps
        ],
        "campaigns": [
            {
                "name": c.name,
                "year": c.year,
                "description": c.description,
            }
            for c in actor.campaigns
        ],
        "description": actor.description,
        "tagline": actor.tagline,
        "rarity": actor.rarity,
        "image_url": actor.image_url,
        "image_prompt": actor.image_prompt,
        "sources": [
            {
                "source": s.source,
                "source_id": s.source_id,
                "fetched_at": s.fetched_at,
                "url": s.url,
            }
            for s in actor.sources
        ],
        "tlp": actor.tlp,
        "last_updated": actor.last_updated,
    }
