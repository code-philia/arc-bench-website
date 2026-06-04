import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import RuntimeType, SubmissionStatus
from app.models.requirement import Requirement
from app.models.submission import Submission
from app.schemas.submission import StepState, SubmissionDetail, SubmissionSummary


DEFAULT_STEPS = [
    StepState(key="deploy_agent", title="Deploy Agent", status="pending", description="Waiting"),
    StepState(key="start_agent", title="Start Agent", status="pending", description="Waiting"),
    StepState(key="run_tests", title="Run Tests", status="pending", description="Waiting"),
]


class SubmissionService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def create_submission(self, requirement_id: str, runtime: RuntimeType, upload: UploadFile) -> Submission:
        if not upload.filename or not upload.filename.lower().endswith(".zip"):
            raise ValueError("Only .zip uploads are supported")
        if runtime != RuntimeType.PYTHON:
            raise ValueError("Only Python submissions are supported in v1")

        requirement = self.db.get(Requirement, requirement_id)
        if not requirement:
            raise LookupError(f"Requirement '{requirement_id}' not found")

        submission_id = uuid.uuid4().hex[:12]
        submission_dir = self.settings.submissions_root / submission_id
        submission_dir.mkdir(parents=True, exist_ok=True)
        archive_path = submission_dir / "agent.zip"

        with archive_path.open("wb") as output:
            shutil.copyfileobj(upload.file, output)

        submission = Submission(
            id=submission_id,
            requirement_id=requirement_id,
            runtime=runtime.value,
            original_filename=upload.filename,
            archive_path=str(archive_path),
            status=SubmissionStatus.PENDING.value,
            steps_json=json.dumps([step.model_dump() for step in DEFAULT_STEPS]),
        )
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)
        return submission

    def list_submissions(self, requirement_id: str | None = None) -> list[SubmissionSummary]:
        query = select(Submission).order_by(desc(Submission.created_at))
        if requirement_id:
            query = query.where(Submission.requirement_id == requirement_id)
        rows = self.db.scalars(query).all()
        return [SubmissionSummary.model_validate(row, from_attributes=True) for row in rows]

    def get_submission(self, submission_id: str) -> Submission:
        submission = self.db.get(Submission, submission_id)
        if not submission:
            raise LookupError(f"Submission '{submission_id}' not found")
        return submission

    def to_detail(self, submission: Submission) -> SubmissionDetail:
        steps = [StepState.model_validate(step) for step in json.loads(submission.steps_json or "[]")]
        tests = []
        if submission.result_path and Path(submission.result_path).exists():
            tests = json.loads(Path(submission.result_path).read_text(encoding="utf-8")).get("tests", [])
        return SubmissionDetail(
            id=submission.id,
            requirement_id=submission.requirement_id,
            runtime=submission.runtime,
            original_filename=submission.original_filename,
            status=submission.status,
            score=submission.score,
            passed_count=submission.passed_count,
            failed_count=submission.failed_count,
            created_at=submission.created_at,
            started_at=submission.started_at,
            finished_at=submission.finished_at,
            failure_reason=submission.failure_reason,
            steps=steps,
            stdout_path=submission.stdout_path,
            stderr_path=submission.stderr_path,
            result_path=submission.result_path,
            workspace_path=submission.workspace_path,
            logs_available=bool(submission.stdout_path or submission.stderr_path),
            tests=tests,
        )

    def update_steps(self, submission: Submission, steps: list[StepState]) -> None:
        submission.steps_json = json.dumps([step.model_dump() for step in steps])
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)

    def mark_running(self, submission: Submission, workspace_path: Path) -> None:
        submission.status = SubmissionStatus.RUNNING.value
        submission.started_at = datetime.utcnow()
        submission.workspace_path = str(workspace_path)
        submission.failure_reason = None
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)

    def finalize(
        self,
        submission: Submission,
        status: SubmissionStatus,
        passed_count: int,
        failed_count: int,
        score: float,
        stdout_path: Path | None,
        stderr_path: Path | None,
        result_path: Path | None,
        failure_reason: str | None = None,
    ) -> None:
        submission.status = status.value
        submission.finished_at = datetime.utcnow()
        submission.passed_count = passed_count
        submission.failed_count = failed_count
        submission.score = score
        submission.stdout_path = str(stdout_path) if stdout_path else None
        submission.stderr_path = str(stderr_path) if stderr_path else None
        submission.result_path = str(result_path) if result_path else None
        submission.failure_reason = failure_reason
        self.db.add(submission)
        self.db.commit()

    @staticmethod
    def build_step_states(active_key: str | None = None, completed: set[str] | None = None, description: str | None = None) -> list[StepState]:
        completed = completed or set()
        steps: list[StepState] = []
        for step in DEFAULT_STEPS:
            status = "pending"
            step_description = step.description
            if step.key in completed:
                status = "completed"
                step_description = "Done"
            elif active_key == step.key:
                status = "running"
                step_description = description or "Running"
            steps.append(StepState(key=step.key, title=step.title, status=status, description=step_description))
        return steps
