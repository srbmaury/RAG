"""Atlas migrations use the configured SQLAlchemy engine."""

from alembic import context

from app.db import Base, engine

target_metadata = Base.metadata


def run_migrations_online():
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
