"""Recover evaluation runs whose Worker lease expired."""

from __future__ import annotations

import logging
import time
from datetime import datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.run import Run
from app.services.docker_manager import DockerManager
from app.services.submission_service import RunService
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
            .where(Run.status.in_(["STARTING", "RUNNING", "PAUSE_REQUESTED"]), Run.lease_until < now)
            .order_by(Run.lease_until)
            .with_for_update(skip_locked=True)
            .limit(batch_size)
        ).all()
        docker_manager = DockerManager() if runs else None
        for run in runs:
            # The old Worker may have died after creating a container. Remove
            # it before requeueing so a replacement Worker cannot run the same
            # Run alongside the stale container.
            assert docker_manager is not None
            docker_manager.remove_submission_container(run.id)
            if run.status == "PAUSE_REQUESTED":
                # A worker can die after the user requested pause but before
                # the execution loop persists PAUSED. Preserve the user's
                # intent instead of requeueing the run or leaving its lease
                # to occupy a concurrency slot indefinitely.
                run.status = "PAUSED"
                run.worker_id = None
                run.celery_task_id = None
                run.lease_until = None
                run.heartbeat_at = None
                try:
                    service = RunService(db)
                    service.set_checkpoint_restart_flag(run)
                    service.mark_paused_for_manual_edit(
                        service.get_submission(run.id),
                        reason="Worker recovered after an immediate pause request; workspace is ready for manual edits",
                    )
                except Exception:
                    # The database state is still made terminal for the old
                    # worker; resume can retry the workspace metadata setup.
                    LOG.exception("failed to persist manual-edit metadata for paused run %s", run.id)
                continue
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
