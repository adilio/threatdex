"""Initial schema: threat_actors + sync_logs tables.

Revision ID: 001
Revises:
Create Date: 2026-03-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── threat_actors ─────────────────────────────────────────────────────────
    op.create_table(
        "threat_actors",
        # Primary key
        sa.Column("id", sa.String(128), primary_key=True),
        # Identity
        sa.Column("canonical_name", sa.String(256), nullable=False),
        sa.Column("aliases", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("mitre_id", sa.String(16), nullable=True),
        # Attribution
        sa.Column("country", sa.String(128), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=True),
        # Classification
        sa.Column("motivation", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("threat_level", sa.Integer, nullable=False),
        sa.Column("sophistication", sa.String(32), nullable=False),
        sa.Column("rarity", sa.String(16), nullable=False),
        sa.Column("tlp", sa.String(8), nullable=False, server_default="'WHITE'"),
        # Timeline
        sa.Column("first_seen", sa.String(4), nullable=True),
        sa.Column("last_seen", sa.String(4), nullable=True),
        # Targeting
        sa.Column("sectors", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("geographies", postgresql.JSONB, nullable=False, server_default="[]"),
        # Capabilities
        sa.Column("tools", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("ttps", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("campaigns", postgresql.JSONB, nullable=False, server_default="[]"),
        # Narrative
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("tagline", sa.String(512), nullable=True),
        # Media
        sa.Column("image_url", sa.String(1024), nullable=True),
        sa.Column("image_prompt", sa.Text, nullable=True),
        # Provenance
        sa.Column("sources", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column(
            "last_updated",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        # Audit timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Standard B-tree indexes
    op.create_index("ix_threat_actors_canonical_name", "threat_actors", ["canonical_name"])
    op.create_index("ix_threat_actors_rarity", "threat_actors", ["rarity"])
    op.create_index("ix_threat_actors_country", "threat_actors", ["country"])

    # GIN index for efficient JSONB array containment queries (PostgreSQL only)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_threat_actors_motivation_gin "
        "ON threat_actors USING gin (motivation)"
    )

    # ── sync_logs ─────────────────────────────────────────────────────────────
    op.create_table(
        "sync_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="'running'"),
        sa.Column("records_synced", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
    )

    op.create_index("ix_sync_logs_source", "sync_logs", ["source"])


def downgrade() -> None:
    op.drop_index("ix_sync_logs_source", table_name="sync_logs")
    op.drop_table("sync_logs")

    op.execute("DROP INDEX IF EXISTS ix_threat_actors_motivation_gin")
    op.drop_index("ix_threat_actors_country", table_name="threat_actors")
    op.drop_index("ix_threat_actors_rarity", table_name="threat_actors")
    op.drop_index("ix_threat_actors_canonical_name", table_name="threat_actors")
    op.drop_table("threat_actors")
