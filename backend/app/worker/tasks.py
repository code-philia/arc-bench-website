"""Celery tasks for asynchronous ARC-Bench evaluation."""

from celery import Task

from app.db.session import SessionLocal
from app.worker.celery_app import celery_app
from app.worker.run_claims import claim_run


class ArcBenchTask(Task):
    autoretry_for = (TimeoutError, ConnectionError)
    retry_backoff = True
    retry_backoff_max = 300
    retry_jitter = True
    max_retries = 2


@celery_app.task(bind=True, base=ArcBenchTask, name="arcbench.run_submission", acks_late=True)
def run_submission_task(self: Task, run_id: str, reuse_workspace: bool = False) -> dict[str, str]:
    """Claim and execute one run. Duplicate Celery deliveries are harmless."""
    worker_id = str(self.request.hostname or "unknown-worker")
    db = SessionLocal()
    try:
        if not claim_run(db, run_id, worker_id):
            return {"run_id": run_id, "status": "already_claimed"}

        # ExecutionService owns the detailed state transitions and artifact
        # handling. It creates its own short-lived session internally.
        from app.services.execution_service import ExecutionService

        if reuse_workspace:
            ExecutionService(db).rerun_submission(run_id)
        else:
            ExecutionService(db).run_submission(run_id)
        return {"run_id": run_id, "status": "completed"}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

