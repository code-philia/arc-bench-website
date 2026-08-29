"""Small durable Outbox dispatcher that publishes rows to Celery."""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.task_outbox import TaskOutbox
from app.models.run import Run
from app.worker.tasks import run_submission_task

LOG = logging.getLogger("arcbench.dispatcher")


def dispatch_once(batch_size: int = 100) -> int:
    """Publish one batch; rows remain pending if publish or DB update fails."""
    db = SessionLocal()
    try:
        rows = db.scalars(
            select(TaskOutbox)
            .where(TaskOutbox.sent_at.is_(None))
            .order_by(TaskOutbox.created_at)
            .with_for_update(skip_locked=True)
            .limit(batch_size)
        ).all()
        published = 0
        for row in rows:
            try:
                payload = json.loads(row.payload_json)
                result = run_submission_task.apply_async(
                    kwargs={"run_id": payload["run_id"], "reuse_workspace": bool(payload.get("reuse_workspace", False))},
                    task_id=f"arcbench-{row.id}",
                    queue="evaluation.default",
                )
                row.sent_at = datetime.utcnow()
                row.attempt_count += 1
                row.last_error = None
                # Keep the Celery id useful for support and cancellation.
                run = getattr(result, "id", None)
                if run:
                    db.query(Run).filter(Run.id == row.run_id).update({Run.celery_task_id: run})
                    LOG.info("dispatched outbox=%s task=%s", row.id, run)
                published += 1
            except Exception as exc:  # noqa: BLE001
                row.attempt_count += 1
                row.last_error = f"{type(exc).__name__}: {exc}"[:2000]
                LOG.exception("failed to dispatch outbox=%s", row.id)
        db.commit()
        return published
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    interval = 2.0
    LOG.info("ARC-Bench Outbox dispatcher started")
    while True:
        dispatch_once()
        time.sleep(interval)


if __name__ == "__main__":
    main()
