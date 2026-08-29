"""Export every PostgreSQL table to an individual CSV file.

The URL may be a normal PostgreSQL URL or SQLAlchemy's
``postgresql+psycopg://`` form. Table and schema names are read from
PostgreSQL and quoted with psycopg.sql.Identifier; user input is never
concatenated into an SQL identifier.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

from sqlalchemy.engine import make_url


def _psycopg_url(value: str) -> str:
    url = make_url(value)
    if url.get_backend_name() != "postgresql":
        raise ValueError("The URL must use PostgreSQL (postgresql+psycopg://...)")
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def _safe_filename(schema: str, table: str) -> str:
    value = f"{schema}__{table}"
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value) + ".csv"


def export_tables(url_value: str, output_dir: Path, schema: str | None, force: bool) -> int:
    try:
        import psycopg
        from psycopg import sql
    except ImportError as exc:
        raise RuntimeError("psycopg is not installed; run: python -m pip install -r backend/requirements.txt") from exc

    output_dir.mkdir(parents=True, exist_ok=True)
    table_query = """
        SELECT schemaname, tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND (%s::text IS NULL OR schemaname = %s::text)
        ORDER BY schemaname, tablename
    """
    exported = 0
    with psycopg.connect(_psycopg_url(url_value)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(table_query, (schema, schema))
            tables = cursor.fetchall()
        if not tables:
            scope = f" schema {schema!r}" if schema else ""
            print(f"No PostgreSQL tables found in{scope}.", file=sys.stderr)
            return 0

        for table_schema, table_name in tables:
            destination = output_dir / _safe_filename(table_schema, table_name)
            if destination.exists() and not force:
                raise FileExistsError(
                    f"Refusing to overwrite {destination}; use --force to replace existing CSV files"
                )
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            copy_statement = sql.SQL("COPY (SELECT * FROM {}.{}) TO STDOUT WITH (FORMAT CSV, HEADER TRUE)").format(
                sql.Identifier(table_schema),
                sql.Identifier(table_name),
            )
            try:
                with temporary.open("wb") as output:
                    with connection.cursor().copy(copy_statement) as copy:
                        while data := copy.read():
                            output.write(data)
                temporary.replace(destination)
            except Exception:
                temporary.unlink(missing_ok=True)
                raise
            print(f"Exported {table_schema}.{table_name} -> {destination}")
            exported += 1
    return exported


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export every non-system PostgreSQL table to one CSV file per table"
    )
    parser.add_argument(
        "--url-env",
        default="ARCBENCH_DATABASE_URL",
        help="environment variable containing the PostgreSQL URL (default: ARCBENCH_DATABASE_URL)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("backups/postgresql-csv"),
        help="directory for CSV files (default: backups/postgresql-csv)",
    )
    parser.add_argument(
        "--schema",
        default=None,
        help="export only this schema; default exports every non-system schema",
    )
    parser.add_argument("--force", action="store_true", help="overwrite existing CSV files")
    args = parser.parse_args()
    value = os.environ.get(args.url_env, "").strip()
    if not value:
        parser.error(f"Set {args.url_env} to a PostgreSQL URL")
    try:
        count = export_tables(value, args.output_dir, args.schema, args.force)
    except (ValueError, RuntimeError, FileExistsError, OSError) as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1
    print(f"Export complete: {count} table(s) written to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
