"""Add Celery leases and durable task outbox."""

from alembic import op

revision = "20260829_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS worker_id VARCHAR(255)")
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS celery_task_id VARCHAR(255)")
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_until TIMESTAMP")
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP")
    op.execute("ALTER TABLE runs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0")
    op.execute("CREATE INDEX IF NOT EXISTS ix_runs_status_lease_until ON runs (status, lease_until)")
    op.execute("""CREATE TABLE IF NOT EXISTS task_outbox (
        id VARCHAR(64) PRIMARY KEY,
        run_id VARCHAR(64) NOT NULL,
        task_name VARCHAR(120) NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NULL
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_outbox_run_id ON task_outbox (run_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_outbox_sent_created ON task_outbox (sent_at, created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_task_outbox_sent_created")
    op.execute("DROP INDEX IF EXISTS ix_task_outbox_run_id")
    op.execute("DROP TABLE IF EXISTS task_outbox")
    op.execute("DROP INDEX IF EXISTS ix_runs_status_lease_until")
    for column in ("attempt_count", "heartbeat_at", "lease_until", "celery_task_id", "worker_id"):
        op.execute(f"ALTER TABLE runs DROP COLUMN IF EXISTS {column}")
