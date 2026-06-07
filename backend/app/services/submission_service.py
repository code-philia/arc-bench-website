import json
import shutil
import uuid
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import RuntimeType, SubmissionStatus
from app.models.requirement import Requirement
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submission import StepState, SubmissionDetail, SubmissionSummary
from app.services.runtime_path_service import RuntimePathService


DEFAULT_STEPS = [
    StepState(
        key="deploy_agent",
        title="Deploy Agent",
        status="pending",
        description="Pull runner container, prepare workspace, and install agent dependencies.",
    ),
    StepState(
        key="start_agent",
        title="Run Agent",
        status="pending",
        description="Execute the agent until it finishes the task and exits cleanly.",
    ),
    StepState(
        key="run_tests",
        title="Run Tests",
        status="pending",
        description="Execute the benchmark test suite against the finished task output.",
    ),
]


class SubmissionService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.runtime_paths = RuntimePathService()

    def _get_submission_user(self, user_id: str) -> User:
        user = self.db.get(User, user_id)
        if not user:
            raise LookupError(f"User '{user_id}' not found")
        return user

    def create_submission(
        self,
        requirement_id: str,
        runtime: RuntimeType,
        upload: UploadFile,
        user_id: str,
        display_name: str | None = None,
        model_name: str | None = None,
    ) -> Submission:
        if not upload.filename or not upload.filename.lower().endswith(".zip"):
            raise ValueError("Only .zip uploads are supported")
        if runtime != RuntimeType.PYTHON:
            raise ValueError("Only Python submissions are supported in v1")

        requirement = self.db.get(Requirement, requirement_id)
        if not requirement:
            raise LookupError(f"Requirement '{requirement_id}' not found")
        if requirement.category != "web":
            raise ValueError("Only web requirements are supported in v1")

        submission_id = uuid.uuid4().hex[:12]
        user = self._get_submission_user(user_id)
        draft_submission = Submission(id=submission_id, user_id=user_id)
        submission_dir = self.runtime_paths.get_submission_root(draft_submission, username=user.username)
        submission_dir.mkdir(parents=True, exist_ok=True)
        archive_path = submission_dir / "agent.zip"

        with archive_path.open("wb") as output:
            shutil.copyfileobj(upload.file, output)

        self._validate_python_agent_archive(archive_path)
        self.append_event_log_for_identity(submission_id, user_id, user.username, f"[ok] Uploaded archive saved to {archive_path.name}")
        self.append_event_log_for_identity(submission_id, user_id, user.username, "[ok] Archive validation passed")

        normalized_display_name = self._normalize_display_name(display_name)
        normalized_model_name = self._normalize_model_name(model_name)

        submission = Submission(
            id=submission_id,
            user_id=user_id,
            display_name=normalized_display_name,
            model_name=normalized_model_name,
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

    def append_event_log(self, submission_id: str, message: str) -> Path:
        submission = self.get_submission(submission_id)
        submission_dir = self.runtime_paths.get_submission_root(
            submission,
            username=self._get_submission_user(submission.user_id or "").username,
        )
        submission_dir.mkdir(parents=True, exist_ok=True)
        log_path = submission_dir / "events.log"
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        with log_path.open("a", encoding="utf-8") as output:
            output.write(f"[{timestamp}] {message}\n")
        return log_path

    def append_event_log_for_identity(self, submission_id: str, user_id: str, username: str, message: str) -> Path:
        log_path = self.runtime_paths.get_event_log_path_by_identity(username, user_id, submission_id)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        with log_path.open("a", encoding="utf-8") as output:
            output.write(f"[{timestamp}] {message}\n")
        return log_path

    @staticmethod
    def _normalize_display_name(display_name: str | None) -> str | None:
        if display_name is None:
            return None
        normalized = " ".join(display_name.strip().split())
        if not normalized:
            return None
        if len(normalized) > 120:
            raise ValueError("Submission name must be 120 characters or fewer")
        return normalized

    @staticmethod
    def _normalize_model_name(model_name: str | None) -> str | None:
        if model_name is None:
            return None
        normalized = " ".join(model_name.strip().split())
        if not normalized:
            return None
        if len(normalized) > 120:
            raise ValueError("Model name must be 120 characters or fewer")
        return normalized

    def append_step_event(
        self,
        submission_id: str,
        step_key: Literal["deploy_agent", "start_agent", "run_tests"],
        message: str,
        status: Literal["info", "success", "error"] = "info",
    ) -> Path:
        submission = self.get_submission(submission_id)
        submission_dir = self.runtime_paths.get_submission_root(
            submission,
            username=self._get_submission_user(submission.user_id or "").username,
        )
        submission_dir.mkdir(parents=True, exist_ok=True)
        log_path = submission_dir / "events.log"
        payload = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "step_key": step_key,
            "status": status,
            "message": message,
        }
        with log_path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(payload, ensure_ascii=True) + "\n")
        return log_path

    def get_event_log_path(self, submission: Submission) -> Path:
        username = self._get_submission_user(submission.user_id or "").username if submission.user_id else None
        return self.runtime_paths.get_event_log_path(submission, username=username)

    @staticmethod
    def _validate_python_agent_archive(archive_path: Path) -> None:
        try:
            with zipfile.ZipFile(archive_path, "r") as archive:
                members = [Path(info.filename) for info in archive.infolist() if not info.is_dir()]
        except zipfile.BadZipFile as exc:
            raise ValueError("Uploaded file is not a valid zip archive") from exc

        if not members:
            raise ValueError("Uploaded zip archive is empty")

        normalized_members = [member for member in members if member.name and not member.name.startswith(".")]
        root_level_members = [member for member in normalized_members if len(member.parts) == 1]
        roots = {member.parts[0] for member in normalized_members if member.parts}
        if not root_level_members and len(roots) == 1:
            root_name = next(iter(roots))
            candidate_paths = [Path(*member.parts[1:]) for member in normalized_members if len(member.parts) > 1 and member.parts[0] == root_name]
        else:
            candidate_paths = normalized_members

        root_files = {path.as_posix() for path in candidate_paths if len(path.parts) == 1}
        missing = [name for name in ("main.py", "requirements.txt") if name not in root_files]
        if missing:
            raise ValueError(f"Uploaded zip must include {', '.join(missing)} at the archive root")

    def list_submissions(self, user_id: str, requirement_id: str | None = None) -> list[SubmissionSummary]:
        query = select(Submission).where(Submission.user_id == user_id).order_by(desc(Submission.created_at))
        if requirement_id:
            query = query.where(Submission.requirement_id == requirement_id)
        rows = self.db.scalars(query).all()
        return [SubmissionSummary.model_validate(row, from_attributes=True) for row in rows]

    def get_submission(self, submission_id: str, user_id: str | None = None) -> Submission:
        submission = self.db.get(Submission, submission_id)
        if not submission or (user_id is not None and submission.user_id != user_id):
            raise LookupError(f"Submission '{submission_id}' not found")
        return submission

    def to_detail(self, submission: Submission) -> SubmissionDetail:
        events: list[dict] = []
        event_log_path = self.get_event_log_path(submission)
        if event_log_path.exists():
            events = self.read_events(submission)
        steps = [StepState.model_validate(step) for step in json.loads(submission.steps_json or "[]")]
        steps = self.attach_step_logs(steps, events)
        tests = []
        if submission.result_path and Path(submission.result_path).exists():
            tests = json.loads(Path(submission.result_path).read_text(encoding="utf-8")).get("tests", [])
        return SubmissionDetail(
            id=submission.id,
            display_name=submission.display_name,
            model_name=submission.model_name,
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

    def read_events(self, submission: Submission) -> list[dict]:
        event_log_path = self.get_event_log_path(submission)
        if not event_log_path.exists():
            return []
        events: list[dict] = []
        for raw_line in event_log_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(parsed, dict):
                continue
            timestamp = str(parsed.get("timestamp", "")).strip()
            step_key = str(parsed.get("step_key", "")).strip()
            status = str(parsed.get("status", "info")).strip() or "info"
            message = str(parsed.get("message", "")).strip()
            if not timestamp or not step_key or not message:
                continue
            events.append(
                {
                    "timestamp": timestamp,
                    "step_key": step_key,
                    "status": status,
                    "message": message,
                }
            )
        return events

    def read_event_lines(self, submission: Submission) -> list[str]:
        return [
            f"[{event['timestamp']}] [{event['step_key']}] [{event['status']}] {event['message']}"
            for event in self.read_events(submission)
        ]

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
            steps.append(StepState(key=step.key, title=step.title, status=status, description=step_description, logs=[]))
        return steps

    @staticmethod
    def build_failed_step_states(failed_key: str, reason: str, completed: set[str] | None = None) -> list[StepState]:
        completed = completed or set()
        steps: list[StepState] = []
        for step in DEFAULT_STEPS:
            if step.key in completed:
                status = "completed"
                step_description = "Done"
            elif step.key == failed_key:
                status = "failed"
                step_description = reason
            else:
                status = "pending"
                step_description = "Not reached"
            steps.append(StepState(key=step.key, title=step.title, status=status, description=step_description, logs=[]))
        return steps

    @staticmethod
    def attach_step_logs(steps: list[StepState], events: list[dict]) -> list[StepState]:
        enriched: list[StepState] = []
        for step in steps:
            step_logs = [
                f"[{event['timestamp']}] [{event['status']}] {event['message']}"
                for event in events
                if event.get("step_key") == step.key
            ]
            step_data = step.model_dump()
            step_data["logs"] = step_logs[-5:]
            enriched.append(StepState(**step_data))
        return enriched
