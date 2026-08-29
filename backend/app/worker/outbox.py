"""Helpers for writing durable Celery messages in the same DB transaction."""

import json
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.task_outbox import TaskOutbox


def enqueue_run(db: Session, run_id: str, *, reuse_workspace: bool = False) -> TaskOutbox:
    row = TaskOutbox(
        id=uuid.uuid4().hex,
        run_id=run_id,
        task_name="arcbench.run_submission",
        payload_json=json.dumps({"run_id": run_id, "reuse_workspace": reuse_workspace}),
    )
    db.add(row)
    return row


def queue_run(db: Session, run_id: str, *, reuse_workspace: bool = False) -> TaskOutbox | None:
    """Atomically transition a Run to QUEUED and create its Outbox message.

    Returns the new row, or ``None`` when the run is already queued/running or
    terminal. The caller owns the surrounding transaction and must commit.
    """
    run = db.scalar(select(Run).where(Run.id == run_id).with_for_update())
    if run is None:
        raise LookupError(f"Run '{run_id}' not found")
    if run.status == "QUEUED":
        return None
    if run.status not in {"PENDING", "RUNNING", "RESUME_REQUESTED", "PAUSED"}:
        raise ValueError(f"Run '{run_id}' cannot be queued from status {run.status}")
    run.status = "QUEUED"
    run.worker_id = None
    run.lease_until = None
    run.heartbeat_at = None
    row = enqueue_run(db, run_id, reuse_workspace=reuse_workspace)
    db.add(run)
    return row
