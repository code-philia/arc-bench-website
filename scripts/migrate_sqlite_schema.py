from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = ROOT_DIR / "runtime" / "app.db"


def _usage() -> str:
    return (
        "Usage:\n"
        "  python backend/scripts/migrate_sqlite_schema.py [sqlite_db_path]\n\n"
        "Examples:\n"
        "  python backend/scripts/migrate_sqlite_schema.py\n"
        "  python backend/scripts/migrate_sqlite_schema.py D:/project/arc-bench-website/runtime/app.db\n"
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


def main() -> int:
    if len(sys.argv) > 2:
        print(_usage())
        return 1
    db_path = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else DEFAULT_DB_PATH.resolve()
    return migrate(db_path)


if __name__ == "__main__":
    raise SystemExit(main())
