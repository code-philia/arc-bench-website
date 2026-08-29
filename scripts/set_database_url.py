"""Safely write a PostgreSQL database URL into the ignored config.yaml file."""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

import yaml
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


ROOT_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT_DIR / "config.yaml"


def _read_config(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as exc:
        raise RuntimeError(f"Cannot read valid YAML from {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Configuration root must be a YAML mapping: {path}")
    return payload


def _validate_url(value: str) -> str:
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        raise ValueError("Database URL must use postgresql+psycopg://")
    if url.drivername != "postgresql+psycopg":
        url = url.set(drivername="postgresql+psycopg")
    if not url.database:
        raise ValueError("Database URL must include a database name")
    return url.render_as_string(hide_password=False)


def _check_connection(database_url: str) -> None:
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            database = connection.execute(text("SELECT current_database()")).scalar_one()
            user = connection.execute(text("SELECT current_user")).scalar_one()
            print(f"Connection OK: database={database}, user={user}")
    finally:
        engine.dispose()


def _write_config(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    os.chmod(temporary, 0o600)
    temporary.replace(path)
    os.chmod(path, 0o600)


def main() -> int:
    parser = argparse.ArgumentParser(description="Write and verify config.yaml database_url")
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--skip-connection-check", action="store_true")
    args = parser.parse_args()

    value = getpass.getpass("PostgreSQL URL (input hidden): ").strip()
    if not value:
        print("No URL entered; config.yaml was not changed.", file=sys.stderr)
        return 2
    try:
        normalized = _validate_url(value)
        if not args.skip_connection_check:
            _check_connection(normalized)
        payload = _read_config(args.config)
        payload["database_url"] = normalized
        _write_config(args.config, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"Database configuration failed: {exc}", file=sys.stderr)
        return 1
    print(f"Updated {args.config} with permissions 600")
    print("Restart the API process so it creates a new PostgreSQL engine.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
