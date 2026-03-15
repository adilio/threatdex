from datetime import datetime
from enum import StrEnum
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

# ── Enums ─────────────────────────────────────────────────────────────────────


class Motivation(StrEnum):
    espionage = "espionage"
    financial = "financial"
    sabotage = "sabotage"
    hacktivism = "hacktivism"
    military = "military"


class Sophistication(StrEnum):
    low = "Low"
    medium = "Medium"
    high = "High"
    very_high = "Very High"
    nation_state_elite = "Nation-State Elite"


class Rarity(StrEnum):
    mythic = "MYTHIC"
    legendary = "LEGENDARY"
    epic = "EPIC"
    rare = "RARE"


class TLP(StrEnum):
    white = "WHITE"
    green = "GREEN"


class SourceName(StrEnum):
    mitre = "mitre"
    etda = "etda"
    otx = "otx"
    misp = "misp"
    opencti = "opencti"
    manual = "manual"


# ── Nested schemas ────────────────────────────────────────────────────────────


class TTPUsage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    techniqueId: str = Field(..., description="MITRE technique ID, e.g. T1566")
    techniqueName: str
    tactic: str


class Campaign(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    year: str | None = None
    description: str


class SourceAttribution(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source: SourceName
    sourceId: str | None = None
    fetchedAt: str = Field(..., description="ISO 8601 timestamp")
    url: str | None = None


# ── ThreatActor schemas ───────────────────────────────────────────────────────


class ThreatActorBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="Slug, e.g. 'apt28'")
    canonicalName: str
    aliases: list[str] = []
    mitreId: str | None = None
    country: str | None = None
    countryCode: str | None = None
    motivation: list[Motivation] = []
    threatLevel: int = Field(..., ge=1, le=10)
    sophistication: Sophistication
    firstSeen: str | None = None
    lastSeen: str | None = None
    sectors: list[str] = []
    geographies: list[str] = []
    tools: list[str] = []
    ttps: list[TTPUsage] = []
    campaigns: list[Campaign] = []
    description: str
    tagline: str | None = None
    rarity: Rarity
    imageUrl: str | None = None
    imagePrompt: str | None = None
    sources: list[SourceAttribution] = []
    tlp: TLP
    lastUpdated: str = Field(..., description="ISO 8601 timestamp")


class ThreatActorCreate(ThreatActorBase):
    """Schema for creating / upserting a ThreatActor."""

    pass


class ThreatActorResponse(ThreatActorBase):
    """Schema returned to API consumers."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @classmethod
    def from_orm_model(cls, actor: object) -> "ThreatActorResponse":
        """Convert a SQLAlchemy ThreatActor ORM row to this response schema."""
        from models import ThreatActor as ORMActor

        a: ORMActor = actor  # type: ignore[assignment]
        return cls(
            id=a.id,
            canonicalName=a.canonical_name,
            aliases=a.aliases or [],
            mitreId=a.mitre_id,
            country=a.country,
            countryCode=a.country_code,
            motivation=[Motivation(m) for m in (a.motivation or [])],
            threatLevel=a.threat_level,
            sophistication=Sophistication(a.sophistication),
            firstSeen=a.first_seen,
            lastSeen=a.last_seen,
            sectors=a.sectors or [],
            geographies=a.geographies or [],
            tools=a.tools or [],
            ttps=[TTPUsage(**t) for t in (a.ttps or [])],
            campaigns=[Campaign(**c) for c in (a.campaigns or [])],
            description=a.description,
            tagline=a.tagline,
            rarity=Rarity(a.rarity),
            imageUrl=a.image_url,
            imagePrompt=a.image_prompt,
            sources=[SourceAttribution(**s) for s in (a.sources or [])],
            tlp=TLP(a.tlp),
            lastUpdated=a.last_updated.isoformat() if a.last_updated else "",
        )


# ── Pagination ────────────────────────────────────────────────────────────────

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


# ── SyncLog schemas ───────────────────────────────────────────────────────────


class SyncLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    started_at: datetime
    completed_at: datetime | None = None
    status: str
    records_synced: int | None = None
    error_message: str | None = None


class SourceStatus(BaseModel):
    source: str
    last_sync: datetime | None = None
    status: str | None = None
    records_synced: int | None = None
