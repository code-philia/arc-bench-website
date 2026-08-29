"""Database-side leasing for idempotent evaluation tasks."""

from datetime import datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.run import Run


def claim_run(db: Session, run_id: str, worker_id: str, *, lease_seconds: int = 120) -> bool:
    """Atomically claim a queued run; return False for duplicate deliveries."""
    now = datetime.utcnow()
    result = db.execute(
        update(Run)
        .where(
            Run.id == run_id,
            Run.status == "QUEUED",
            (Run.lease_until.is_(None) | (Run.lease_until < now)),
        )
        .values(
            status="STARTING",
            worker_id=worker_id,
            lease_until=now + timedelta(seconds=lease_seconds),
            heartbeat_at=now,
            attempt_count=Run.attempt_count + 1,
        )
    )
    if result.rowcount != 1:
        db.rollback()
        return False
    db.commit()
    return True


def heartbeat_run(db: Session, run_id: str, worker_id: str, *, lease_seconds: int = 120) -> bool:
    now = datetime.utcnow()
    result = db.execute(
        update(Run)
        .where(Run.id == run_id, Run.worker_id == worker_id, Run.status.in_(["STARTING", "RUNNING"]))
        .values(heartbeat_at=now, lease_until=now + timedelta(seconds=lease_seconds))
    )
    db.commit()
    return result.rowcount == 1

