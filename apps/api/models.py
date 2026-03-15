from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from database import Base


class _JSONBCompat(TypeDecorator):
    """
    Stores data as PostgreSQL JSONB when connected to Postgres, and falls back
    to generic JSON (TEXT-backed) when connected to SQLite (e.g. in tests).
    This lets us use JSONB semantics in production without breaking the
    in-memory SQLite test database.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


class ThreatActor(Base):
    __tablename__ = "threat_actors"

    # Primary key — human-readable slug (e.g. "apt28")
    id: Mapped[str] = mapped_column(String(128), primary_key=True)

    # Identity
    canonical_name: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    aliases: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)
    mitre_id: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Attribution
    country: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)

    # Classification
    motivation: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)
    threat_level: Mapped[int] = mapped_column(Integer, nullable=False)
    sophistication: Mapped[str] = mapped_column(String(32), nullable=False)
    rarity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    tlp: Mapped[str] = mapped_column(String(8), nullable=False, default="WHITE")

    # Timeline
    first_seen: Mapped[str | None] = mapped_column(String(4), nullable=True)
    last_seen: Mapped[str | None] = mapped_column(String(4), nullable=True)

    # Targeting
    sectors: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)
    geographies: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)

    # Capabilities
    tools: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)
    ttps: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)
    campaigns: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)

    # Narrative
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tagline: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Media
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    image_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Provenance
    sources: Mapped[list] = mapped_column(_JSONBCompat, nullable=False, default=list)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("ix_threat_actors_rarity", "rarity"),
        Index("ix_threat_actors_country", "country"),
        # GIN index for fast JSONB containment queries on motivation array (PostgreSQL only)
        Index(
            "ix_threat_actors_motivation_gin",
            "motivation",
            postgresql_using="gin",
            sqlite_not_valid=True,  # SQLite silently ignores unknown dialect opts
        ),
    )


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="'running'"
    )
    records_synced: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
