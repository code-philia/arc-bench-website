"""Helpers for writing durable Celery messages in the same DB transaction."""

import json
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.competition_account import Team, TeamMembership
from app.models.run import Run
from app.models.task_outbox import TaskOutbox
from app.models.user import User

ACTIVE_RUN_STATUSES = ("QUEUED", "STARTING", "RUNNING", "PAUSE_REQUESTED", "RESUME_REQUESTED")
MAX_ACTIVE_RUNS = 2


class RunConcurrencyLimitExceeded(ValueError):
    def __init__(self, scope: str, active: int) -> None:
        self.scope = scope
        self.active = active
        super().__init__(f"{scope} already has {active} active runs; maximum is {MAX_ACTIVE_RUNS}")


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

    _enforce_concurrency_limit(db, run.user_id, exclude_run_id=run.id)
    run.status = "QUEUED"
    run.worker_id = None
    run.lease_until = None
    run.heartbeat_at = None
    row = enqueue_run(db, run_id, reuse_workspace=reuse_workspace)
    db.add(run)
    return row


def _enforce_concurrency_limit(db: Session, user_id: str | None, *, exclude_run_id: str | None = None) -> None:
    """Reserve one of two active slots for a user or their team.

    The owner row is locked before counting, so concurrent API requests for the
    same user/team cannot both observe an available slot.
    """
    if not user_id:
        raise ValueError("Run has no owner user")
    membership = db.scalar(select(TeamMembership).where(TeamMembership.user_id == user_id).with_for_update())
    if membership:
        team = db.scalar(select(Team).where(Team.id == membership.team_id).with_for_update())
        if team is None:
            raise ValueError("Run owner team does not exist")
        member_ids = select(TeamMembership.user_id).where(TeamMembership.team_id == team.id)
        query = select(func.count()).select_from(Run).where(Run.user_id.in_(member_ids), Run.status.in_(ACTIVE_RUN_STATUSES))
        if exclude_run_id:
            query = query.where(Run.id != exclude_run_id)
        active = db.scalar(query) or 0
        if active >= MAX_ACTIVE_RUNS:
            raise RunConcurrencyLimitExceeded(f"Team '{team.name}'", int(active))
        return

    # A user without a team consumes their personal quota.
    db.execute(select(User.id).where(User.id == user_id).with_for_update()).scalar_one_or_none()
    query = select(func.count()).select_from(Run).where(Run.user_id == user_id, Run.status.in_(ACTIVE_RUN_STATUSES))
    if exclude_run_id:
        query = query.where(Run.id != exclude_run_id)
    active = db.scalar(query) or 0
    if active >= MAX_ACTIVE_RUNS:
        raise RunConcurrencyLimitExceeded(f"User '{user_id}'", int(active))
