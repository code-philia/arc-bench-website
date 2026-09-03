"""Copy the current ARC-Bench schema and data from SQLite to PostgreSQL.

The destination must not contain data in any ARC-Bench table. The copy runs in
one PostgreSQL transaction and verifies row counts and deterministic content
digests before committing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import Connection, Engine, create_engine, func, inspect, select
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.schema import Table


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.base import Base  # noqa: E402


DEFAULT_SOURCE = ROOT_DIR / "runtime" / "app.db"
DEFAULT_TARGET_ENV = "ARCBENCH_POSTGRES_URL"
# Infrastructure tables introduced after SQLite was retired may legitimately
# be absent from a historical SQLite backup. They are created empty in the
# PostgreSQL destination; old queue messages must never be reconstructed.
OPTIONAL_EMPTY_SOURCE_TABLES = {"task_outbox"}
OPTIONAL_MISSING_SOURCE_COLUMNS = {
    "runs": {"worker_id", "celery_task_id", "lease_until", "heartbeat_at", "attempt_count"},
}


def _database_label(url: URL) -> str:
    return url.render_as_string(hide_password=True)


def _sqlite_url(source: str) -> URL:
    candidate = make_url(source) if "://" in source else make_url(f"sqlite:///{Path(source).resolve().as_posix()}")
    if candidate.get_backend_name() != "sqlite" or not candidate.database or candidate.database == ":memory:":
        raise ValueError("--source must identify a file-backed SQLite database")
    database_path = Path(candidate.database).resolve()
    if not database_path.is_file():
        raise ValueError(f"SQLite source does not exist: {database_path}")
    return make_url(f"sqlite:///{database_path.as_posix()}")


def _postgres_url(value: str) -> URL:
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        raise ValueError("The destination URL must use PostgreSQL")
    if not url.database:
        raise ValueError("The destination URL must include a database name")
    return url


def _expected_tables() -> list[Table]:
    return list(Base.metadata.sorted_tables)


def _validate_source_schema(engine: Engine) -> dict[str, set[str]]:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    expected_tables = {table.name for table in _expected_tables()}
    missing_tables = sorted(expected_tables - existing_tables - OPTIONAL_EMPTY_SOURCE_TABLES)
    if missing_tables:
        raise RuntimeError(f"SQLite source is missing tables: {', '.join(missing_tables)}")

    problems: list[str] = []
    source_columns: dict[str, set[str]] = {}
    for table in _expected_tables():
        if table.name not in existing_tables:
            continue
        actual = {column["name"] for column in inspector.get_columns(table.name)}
        source_columns[table.name] = actual
        expected = {column.name for column in table.columns}
        allowed_missing = OPTIONAL_MISSING_SOURCE_COLUMNS.get(table.name, set())
        missing = sorted(expected - actual - allowed_missing)
        extra = sorted(actual - expected)
        if missing:
            problems.append(f"{table.name}: missing columns {', '.join(missing)}")
        if extra:
            problems.append(f"{table.name}: unexpected columns {', '.join(extra)}")
    if problems:
        raise RuntimeError("SQLite schema does not match the current models:\n  " + "\n  ".join(problems))
    return source_columns


def _refuse_nonempty_target(connection: Connection) -> None:
    inspector = inspect(connection)
    existing_tables = set(inspector.get_table_names())
    nonempty: list[str] = []
    for table in _expected_tables():
        if table.name not in existing_tables:
            continue
        reflected_count = connection.scalar(select(func.count()).select_from(table))
        if int(reflected_count or 0) > 0:
            nonempty.append(table.name)
    if nonempty:
        raise RuntimeError(
            "PostgreSQL destination already contains ARC-Bench data in: "
            + ", ".join(nonempty)
            + ". Use a new empty database; this script never truncates data."
        )


def _validate_target_schema(connection: Connection) -> None:
    inspector = inspect(connection)
    problems: list[str] = []
    for table in _expected_tables():
        actual = {column["name"] for column in inspector.get_columns(table.name)}
        expected = {column.name for column in table.columns}
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        if missing:
            problems.append(f"{table.name}: missing columns {', '.join(missing)}")
        if extra:
            problems.append(f"{table.name}: unexpected columns {', '.join(extra)}")
    if problems:
        raise RuntimeError("PostgreSQL schema does not match the current models:\n  " + "\n  ".join(problems))


def _normalize(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return {"float": value.hex()}
    if isinstance(value, Decimal):
        return {"decimal": str(value)}
    if isinstance(value, (datetime, date, time)):
        return {value.__class__.__name__: value.isoformat()}
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"bytes": bytes(value).hex()}
    return {"repr": repr(value)}


def _table_digest(
    connection: Connection,
    table: Table,
    column_names: set[str] | None = None,
) -> tuple[int, str]:
    primary_key = list(table.primary_key.columns)
    if not primary_key:
        raise RuntimeError(f"Cannot verify table without a primary key: {table.name}")
    selected_columns = [column for column in table.columns if column_names is None or column.name in column_names]
    statement = select(*selected_columns).order_by(*primary_key)
    digest = hashlib.sha256()
    count = 0
    for row in connection.execution_options(stream_results=True).execute(statement):
        values = [_normalize(value) for value in row]
        digest.update(json.dumps(values, ensure_ascii=True, separators=(",", ":")).encode("utf-8"))
        digest.update(b"\n")
        count += 1
    return count, digest.hexdigest()


def _copy_table(
    source: Connection,
    target: Connection,
    table: Table,
    batch_size: int,
    source_column_names: set[str],
) -> int:
    copied = 0
    selected_columns = [column for column in table.columns if column.name in source_column_names]
    result = source.execution_options(stream_results=True).execute(select(*selected_columns))
    while True:
        rows = result.fetchmany(batch_size)
        if not rows:
            break
        payload = [dict(row._mapping) for row in rows]
        target.execute(table.insert(), payload)
        copied += len(payload)
    return copied


def migrate(source_url: URL, target_url: URL, batch_size: int, dry_run: bool) -> None:
    source_engine = create_engine(source_url, connect_args={"check_same_thread": False})
    target_engine = create_engine(target_url, pool_pre_ping=True)
    try:
        source_columns = _validate_source_schema(source_engine)
        initialized_empty = sorted(
            table.name for table in _expected_tables() if table.name not in source_columns
        )
        initialized_columns = {
            table.name: sorted({column.name for column in table.columns} - source_columns.get(table.name, set()))
            for table in _expected_tables()
            if table.name in source_columns
            and {column.name for column in table.columns} - source_columns[table.name]
        }
        with source_engine.connect() as source, target_engine.connect() as target:
            source.exec_driver_sql("PRAGMA query_only = ON")
            source.exec_driver_sql("PRAGMA foreign_keys = ON")
            target.exec_driver_sql("SELECT 1")
            _refuse_nonempty_target(target)
        print(f"Source validated: {_database_label(source_url)}")
        if initialized_empty:
            print(
                "Legacy source does not contain infrastructure tables; "
                f"they will be created empty in PostgreSQL: {', '.join(initialized_empty)}"
            )
        for table_name, columns in initialized_columns.items():
            print(
                f"Legacy source does not contain infrastructure columns in {table_name}; "
                f"PostgreSQL defaults will be used: {', '.join(columns)}"
            )
        print(f"Destination validated: {_database_label(target_url)}")
        if dry_run:
            print("Dry run complete; no destination schema or data was changed.")
            return

        # PostgreSQL supports transactional DDL. A copy or verification failure
        # rolls back both newly created tables and inserted rows.
        with source_engine.connect() as source, target_engine.begin() as target:
            source.exec_driver_sql("PRAGMA query_only = ON")
            source.exec_driver_sql("PRAGMA foreign_keys = ON")
            _refuse_nonempty_target(target)
            Base.metadata.create_all(bind=target)
            _validate_target_schema(target)

            for table in _expected_tables():
                if table.name not in source_columns:
                    print(f"Initialized {table.name}: 0 rows (not present in legacy SQLite source)")
                    continue
                copied = _copy_table(source, target, table, batch_size, source_columns[table.name])
                print(f"Copied {table.name}: {copied} rows")

            for table in _expected_tables():
                if table.name not in source_columns:
                    target_count = int(target.scalar(select(func.count()).select_from(table)) or 0)
                    if target_count != 0:
                        raise RuntimeError(
                            f"Verification failed for {table.name}: expected an empty infrastructure table, "
                            f"destination has {target_count} rows"
                        )
                    print(f"Verified {table.name}: 0 rows (initialized empty)")
                    continue
                source_count, source_digest = _table_digest(source, table, source_columns[table.name])
                target_count, target_digest = _table_digest(target, table, source_columns[table.name])
                if source_count != target_count or source_digest != target_digest:
                    raise RuntimeError(
                        f"Verification failed for {table.name}: "
                        f"source={source_count}/{source_digest}, "
                        f"destination={target_count}/{target_digest}"
                    )
                print(f"Verified {table.name}: {source_count} rows, sha256={source_digest}")
        print("Migration committed successfully.")
    finally:
        source_engine.dispose()
        target_engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate ARC-Bench from SQLite to an empty PostgreSQL database")
    parser.add_argument(
        "--source",
        default=str(DEFAULT_SOURCE),
        help=f"SQLite file or URL (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--target-env",
        default=DEFAULT_TARGET_ENV,
        help=f"environment variable containing the PostgreSQL URL (default: {DEFAULT_TARGET_ENV})",
    )
    parser.add_argument("--batch-size", type=int, default=1000, help="rows inserted per batch (default: 1000)")
    parser.add_argument("--dry-run", action="store_true", help="validate both databases without changing PostgreSQL")
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    target_value = os.environ.get(args.target_env, "").strip()
    if not target_value:
        parser.error(f"Set {args.target_env} to the destination PostgreSQL SQLAlchemy URL")

    try:
        migrate(_sqlite_url(args.source), _postgres_url(target_value), args.batch_size, args.dry_run)
    except (ValueError, RuntimeError, SQLAlchemyError) as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
