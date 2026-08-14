"""Read-only checks for a database created from the current ORM metadata."""

from __future__ import annotations

from sqlalchemy import Engine, inspect

from app.db.base import Base


def verify_current_schema(engine: Engine) -> None:
    """Fail fast when the database was not rebuilt for the current application.

    Schema evolution is intentionally not performed during application startup.
    Use ``scripts/rebuild_database.py --yes`` to create a clean database from
    the current model definitions instead.
    """

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    expected_tables = set(Base.metadata.tables)
    missing_tables = sorted(expected_tables - existing_tables)
    if missing_tables:
        preview = ", ".join(missing_tables[:5])
        suffix = " …" if len(missing_tables) > 5 else ""
        raise RuntimeError(
            "Database schema is not initialized for this ArcBench version "
            f"(missing: {preview}{suffix}). Run "
            "backend/.venv/Scripts/python.exe scripts/rebuild_database.py --yes "
            "from the repository root."
        )
