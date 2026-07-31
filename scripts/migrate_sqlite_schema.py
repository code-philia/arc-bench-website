from __future__ import annotations

import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "runtime" / "app.db"


def _usage() -> str:
    return (
        "Usage:\n"
        "  python scripts/migrate_sqlite_schema.py [sqlite_db_path]\n"
        "  python scripts/migrate_sqlite_schema.py --traceability <traceability_db_path>\n\n"
        "Examples:\n"
        "  python scripts/migrate_sqlite_schema.py\n"
        "  python scripts/migrate_sqlite_schema.py D:/project/arc-bench-website/runtime/app.db\n"
        "  python scripts/migrate_sqlite_schema.py --traceability D:/project/arc-bench-website/runtime/user-submissions/u/s/workspace/artifacts/traceability.db\n"
    )


def _get_columns(cursor: sqlite3.Cursor, table_name: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {str(row[1]) for row in cursor.fetchall() if len(row) > 1}


def _ensure_submission_schema(cursor: sqlite3.Cursor) -> list[str]:
    changes: list[str] = []
    columns = _get_columns(cursor, "submissions")
    if "agent_source" not in columns:
        cursor.execute("ALTER TABLE submissions ADD COLUMN agent_source TEXT NOT NULL DEFAULT 'upload'")
        changes.append("Added submissions.agent_source")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_submissions_agent_source ON submissions (agent_source)")
    changes.append("Ensured index ix_submissions_agent_source")
    return changes


def _ensure_user_schema(cursor: sqlite3.Cursor) -> list[str]:
    changes: list[str] = []
    columns = _get_columns(cursor, "users")
    if "github_email" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN github_email TEXT")
        changes.append("Added users.github_email")
    if "github_username" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN github_username TEXT")
        changes.append("Added users.github_username")
    return changes


def migrate(db_path: Path) -> int:
    if not db_path.exists():
        print(f"Database file not found: {db_path}")
        return 1

    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.cursor()
        changes: list[str] = []
        changes.extend(_ensure_submission_schema(cursor))
        changes.extend(_ensure_user_schema(cursor))
        connection.commit()
    except Exception as exc:  # noqa: BLE001
        connection.rollback()
        print(f"Migration failed: {exc}")
        return 1
    finally:
        connection.close()

    print(f"Migration completed for: {db_path}")
    if changes:
        for item in changes:
            print(f"- {item}")
    else:
        print("- No schema changes were needed")
    return 0


def migrate_traceability(traceability_db_path: Path) -> int:
    if not traceability_db_path.exists():
        print(f"Traceability database file not found: {traceability_db_path}")
        return 1

    connection = sqlite3.connect(traceability_db_path)
    try:
        _ensure_traceability_schema(connection)
    except Exception as exc:  # noqa: BLE001
        connection.rollback()
        print(f"Traceability migration failed: {exc}")
        return 1
    finally:
        connection.close()

    print(f"Traceability migration completed for: {traceability_db_path}")
    print("- Ensured arc-agent compatible requirements/tests/interfaces schema")
    return 0


def _ensure_traceability_schema(connection: sqlite3.Connection) -> None:
    cursor = connection.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS requirements (
            req_id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            visual_reference TEXT,
            scenarios TEXT,
            parent_id TEXT,
            children_ids TEXT,
            dependencies TEXT
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS interfaces (
            interface_id TEXT PRIMARY KEY,
            req_ids TEXT,
            type TEXT,
            content TEXT,
            file_path TEXT,
            first_line TEXT,
            implemented INTEGER,
            callers TEXT,
            callees TEXT
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tests (
            test_id TEXT PRIMARY KEY,
            req_id TEXT,
            interface_ids TEXT,
            type TEXT,
            file_path TEXT,
            passed INTEGER,
            first_line TEXT
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS call_edges (
            source_req_id TEXT,
            target_req_id TEXT,
            from_interface_id TEXT,
            to_interface_id TEXT,
            edge_type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (source_req_id, target_req_id, from_interface_id, to_interface_id)
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS node_states (
            req_id TEXT PRIMARY KEY,
            state TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    _ensure_columns(cursor, "requirements", {"name": "TEXT", "scenarios": "TEXT", "children_ids": "TEXT"})
    _ensure_columns(cursor, "tests", {"interface_ids": "TEXT", "passed": "INTEGER"})
    _backfill_legacy_traceability(cursor)
    connection.commit()


def _ensure_columns(cursor: sqlite3.Cursor, table_name: str, columns: dict[str, str]) -> None:
    existing = _get_columns(cursor, table_name)
    for column_name, column_type in columns.items():
        if column_name in existing:
            continue
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def _table_exists(cursor: sqlite3.Cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        (table_name,),
    )
    return cursor.fetchone() is not None


def _backfill_legacy_traceability(cursor: sqlite3.Cursor) -> None:
    if _table_exists(cursor, "scenarios"):
        grouped_scenarios: dict[str, list[dict[str, object]]] = defaultdict(list)
        for scenario_id, name, req_id, steps in cursor.execute(
            "SELECT scenario_id, name, req_id, steps FROM scenarios ORDER BY scenario_id"
        ).fetchall():
            req_key = str(req_id or "").strip()
            if not req_key:
                continue
            grouped_scenarios[req_key].append(
                {
                    "id": str(scenario_id or "").strip(),
                    "name": str(name or "").strip(),
                    "steps": _parse_json_list_like(steps),
                }
            )
        for req_id, scenarios in grouped_scenarios.items():
            cursor.execute(
                """
                UPDATE requirements
                SET scenarios = ?
                WHERE req_id = ?
                  AND (scenarios IS NULL OR TRIM(scenarios) = '' OR TRIM(scenarios) = '[]')
                """,
                (json.dumps(scenarios, ensure_ascii=False), req_id),
            )

    children_by_parent: dict[str, list[str]] = defaultdict(list)
    for req_id, parent_id, _children_ids in cursor.execute(
        "SELECT req_id, parent_id, children_ids FROM requirements"
    ).fetchall():
        child_id = str(req_id or "").strip()
        parent_key = str(parent_id or "").strip()
        if child_id and parent_key:
            children_by_parent[parent_key].append(child_id)
    for parent_id, child_ids in children_by_parent.items():
        cursor.execute(
            """
            UPDATE requirements
            SET children_ids = ?
            WHERE req_id = ?
              AND (children_ids IS NULL OR TRIM(children_ids) = '' OR TRIM(children_ids) = '[]')
            """,
            (json.dumps(child_ids, ensure_ascii=False), parent_id),
        )


def _parse_json_list_like(raw_value: object) -> list[object]:
    if raw_value is None:
        return []
    try:
        parsed = json.loads(str(raw_value))
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


def main() -> int:
    if len(sys.argv) > 3:
        print(_usage())
        return 1
    if len(sys.argv) >= 2 and sys.argv[1] == "--traceability":
        if len(sys.argv) != 3:
            print(_usage())
            return 1
        return migrate_traceability(Path(sys.argv[2]).resolve())
    db_path = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else DEFAULT_DB_PATH.resolve()
    return migrate(db_path)


if __name__ == "__main__":
    raise SystemExit(main())
