"""Apply the PostgreSQL schema required by Celery leasing and the Outbox."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import create_engine

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "backend"))

from app.core.config import get_settings  # noqa: E402


STATEMENTS = (
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS worker_id VARCHAR(255)",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS celery_task_id VARCHAR(255)",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_until TIMESTAMP",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0",
    "CREATE INDEX IF NOT EXISTS ix_runs_status_lease_until ON runs (status, lease_until)",
    """CREATE TABLE IF NOT EXISTS task_outbox (
        id VARCHAR(64) PRIMARY KEY,
        run_id VARCHAR(64) NOT NULL,
        task_name VARCHAR(120) NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NULL
    )""",
    "CREATE INDEX IF NOT EXISTS ix_task_outbox_run_id ON task_outbox (run_id)",
    "CREATE INDEX IF NOT EXISTS ix_task_outbox_sent_created ON task_outbox (sent_at, created_at)",
)


def main() -> int:
    settings = get_settings()
    engine = create_engine(settings.database_url)
    try:
        with engine.begin() as connection:
            for statement in STATEMENTS:
                connection.execute(text(statement))
    finally:
        engine.dispose()
    print("Celery lease and task_outbox schema: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

