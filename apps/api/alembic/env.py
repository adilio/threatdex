import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

# Make sure our application modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Alembic Config object — gives access to values in alembic.ini
config = context.config

# Interpret the config file for Python logging unless we're being called
# programmatically with logging already configured.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import models so that Base.metadata is populated for autogenerate support.
import models  # noqa: F401, E402
from database import Base  # noqa: E402

target_metadata = Base.metadata


def get_url() -> str:
    """Read the database URL from the environment (preferred) or alembic.ini."""
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url
    raise RuntimeError(
        "DATABASE_URL environment variable is not set and sqlalchemy.url is not configured."
    )


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This mode does not require a live database connection — it emits SQL to
    stdout (or a file) instead.  Useful for generating migration scripts to
    review before running.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    Connects directly to the database and applies pending migrations.
    """
    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
