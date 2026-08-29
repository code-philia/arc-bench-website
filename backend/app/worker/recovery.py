"""Recover evaluation runs whose Worker lease expired."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.run import Run
from app.worker.outbox import enqueue_run

LOG = logging.getLogger("arcbench.recovery")


def recover_once(*, batch_size: int = 100) -> tuple[int, int]:
    """Requeue expired runs; return (requeued, failed)."""
    settings = get_settings()
    db = SessionLocal()
    requeued = failed = 0
    try:
        now = datetime.utcnow()
        runs = db.scalars(
            select(Run)
            .where(Run.status.in_(["STARTING", "RUNNING"]), Run.lease_until < now)
            .order_by(Run.lease_until)
            .with_for_update(skip_locked=True)
            .limit(batch_size)
        ).all()
        for run in runs:
            if run.attempt_count >= settings.recovery_max_attempts:
                run.status = "FAILED"
                run.failure_reason = "Worker lease expired too many times"
                run.finished_at = now
                failed += 1
                continue
            run.status = "QUEUED"
            run.worker_id = None
            run.celery_task_id = None
            run.lease_until = None
            run.heartbeat_at = None
            enqueue_run(db, run.id, reuse_workspace=True)
            requeued += 1
        db.commit()
        return requeued, failed
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = get_settings()
    LOG.info("ARC-Bench lease recovery started")
    while True:
        requeued, failed = recover_once()
        if requeued or failed:
            LOG.info("lease recovery: requeued=%s failed=%s", requeued, failed)
        time.sleep(settings.recovery_interval_seconds)


if __name__ == "__main__":
    main()
