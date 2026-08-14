"""Destructively recreate ARC-Bench's local SQLite database from current models.

Run from the repository root:

    backend\\.venv\\Scripts\\python.exe scripts\\rebuild_database.py --yes

The script only accepts the configured SQLite database below ``runtime/``. It
does not remove runtime submission files; those are separate user artifacts.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.schema_validation import verify_current_schema  # noqa: E402
from app.services.beta_invite_service import BetaInviteService  # noqa: E402


def _sqlite_database_path(database_url: str) -> Path:
    url = make_url(database_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise ValueError("Only a file-backed SQLite database can be rebuilt by this script")
    database_path = Path(url.database).resolve()
    runtime_root = (ROOT_DIR / "runtime").resolve()
    try:
        database_path.relative_to(runtime_root)
    except ValueError as exc:
        raise ValueError("Refusing to rebuild a database outside this repository's runtime directory") from exc
    return database_path


def rebuild_database(database_url: str, beta_invite_codes_path: Path) -> Path:
    """Delete the validated SQLite file and recreate all current ORM tables."""

    database_path = _sqlite_database_path(database_url)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    for path in (database_path, Path(f"{database_path}-wal"), Path(f"{database_path}-shm")):
        if path.exists():
            path.unlink()

    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    try:
        Base.metadata.create_all(bind=engine)
        verify_current_schema(engine)
        session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            # Invitation codes are operator configuration, not user data. Their
            # current used/unused state is read from the external YAML seed.
            BetaInviteService(session).seed_from_file(beta_invite_codes_path)
        finally:
            session.close()
    finally:
        engine.dispose()
    return database_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Destructively rebuild the local ArcBench SQLite database")
    parser.add_argument("--yes", action="store_true", help="confirm permanent deletion of the configured database")
    args = parser.parse_args()
    if not args.yes:
        parser.error("This operation deletes all database records. Re-run with --yes to continue.")

    settings = get_settings()
    path = rebuild_database(settings.database_url, settings.beta_invite_codes_path)
    print(f"Rebuilt ArcBench database from current models: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
