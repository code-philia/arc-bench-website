"""Check that ARC-Bench can connect to PostgreSQL and has the expected schema."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.db.base import Base  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Check an ARC-Bench PostgreSQL database")
    parser.add_argument("--url-env", default="ARCBENCH_DATABASE_URL")
    args = parser.parse_args()
    value = os.environ.get(args.url_env, "").strip()
    if not value:
        print(f"Set {args.url_env} to a PostgreSQL SQLAlchemy URL", file=sys.stderr)
        return 2
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        print("The URL must use postgresql+psycopg://", file=sys.stderr)
        return 2
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            print(connection.execute(text("SELECT version()")).scalar_one())
            print(f"Database: {connection.execute(text('SELECT current_database()')).scalar_one()}")
            print(f"User: {connection.execute(text('SELECT current_user')).scalar_one()}")
            existing = set(inspect(connection).get_table_names())
            missing = sorted(set(Base.metadata.tables) - existing)
            if missing:
                print(f"Missing tables: {', '.join(missing)}", file=sys.stderr)
                return 1
            print(f"Schema OK: {len(Base.metadata.tables)} expected tables present")
    finally:
        engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
