import json
import subprocess
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
from app.schemas.submission import StepState, SubmissionDetail, SubmissionRunnerEvent, SubmissionSummary, SubmissionVisualEvent
from app.services.docker_manager import DockerManager
from app.services.requirement_catalog import RequirementCatalogService
from app.services.runtime_path_service import RuntimePathService
from app.services.submission_artifact_service import SubmissionArtifactService


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
        self.artifact_service = SubmissionArtifactService()

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
        catalog: str = "playground",
        display_name: str | None = None,
        model_name: str | None = None,
    ) -> Submission:
        if not upload.filename or not upload.filename.lower().endswith(".zip"):
            raise ValueError("Only .zip uploads are supported")
        if runtime != RuntimeType.PYTHON:
            raise ValueError("Only Python submissions are supported in v1")

        RequirementCatalogService.for_catalog(self.db, catalog).sync_to_db(requirement_id)
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

    def get_submission_checkpoint_path(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        return workspace_path / "artifacts" / "checkpoint.json"

    def get_pause_request_path(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        return workspace_path / "artifacts" / "pause.request.json"

    def get_resume_request_path(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        return workspace_path / "artifacts" / "resume.request.json"

    def read_checkpoint(self, submission: Submission) -> dict:
        checkpoint_path = self.get_submission_checkpoint_path(submission)
        if checkpoint_path is None or not checkpoint_path.exists():
            return {}
        try:
            payload = json.loads(checkpoint_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        return payload if isinstance(payload, dict) else {}

    def write_checkpoint(self, submission: Submission, payload: dict) -> Path:
        checkpoint_path = self.get_submission_checkpoint_path(submission)
        if checkpoint_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = checkpoint_path.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        tmp_path.replace(checkpoint_path)
        return checkpoint_path

    def get_template_repo_path(self, submission: Submission) -> Path | None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return None
        template_path = workspace_path / "template"
        return template_path if template_path.is_dir() else None

    def read_submission_task_documents(self, submission: Submission) -> dict[str, str]:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            return {"requirements_md": "", "requirements_yaml": "", "prerequisites_md": ""}
        task_dir = workspace_path / "task"
        requirements_md = self._read_text(task_dir / "requirements.md")
        requirements_yaml = self._read_text(task_dir / "requirements.yaml")
        prerequisites_md = self._read_text(task_dir / "prerequisites.md")
        return {
            "requirements_md": requirements_md,
            "requirements_yaml": requirements_yaml,
            "prerequisites_md": prerequisites_md,
        }

    def write_submission_task_documents(
        self,
        submission: Submission,
        *,
        requirements_md: str,
        requirements_yaml: str,
        prerequisites_md: str,
    ) -> None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        task_dir = workspace_path / "task"
        task_dir.mkdir(parents=True, exist_ok=True)
        (task_dir / "requirements.md").write_text(requirements_md, encoding="utf-8")
        (task_dir / "requirements.yaml").write_text(requirements_yaml, encoding="utf-8")
        (task_dir / "prerequisites.md").write_text(prerequisites_md, encoding="utf-8")

    def write_submission_traceability_store(self, submission: Submission, requirements_yaml: str) -> None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        traceability_db_path = workspace_path / "artifacts" / "traceability.db"
        from app.services.traceability_seed_builder import TraceabilitySeedBuilder

        TraceabilitySeedBuilder().write_sqlite_database_from_yaml_text(traceability_db_path, requirements_yaml)

    def request_pause(self, submission: Submission) -> None:
        request_path = self.get_pause_request_path(submission)
        if request_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        request_path.parent.mkdir(parents=True, exist_ok=True)
        request_path.write_text(
            json.dumps({"requested_at": datetime.utcnow().isoformat(), "submission_id": submission.id}, indent=2) + "\n",
            encoding="utf-8",
        )
        self.update_status(submission, SubmissionStatus.PAUSE_REQUESTED)

    def request_resume(self, submission: Submission) -> None:
        request_path = self.get_resume_request_path(submission)
        if request_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        request_path.parent.mkdir(parents=True, exist_ok=True)
        request_path.write_text(
            json.dumps({"requested_at": datetime.utcnow().isoformat(), "submission_id": submission.id}, indent=2) + "\n",
            encoding="utf-8",
        )
        self.update_status(submission, SubmissionStatus.RUNNING)

    def clear_runtime_request_files(self, submission: Submission) -> None:
        for path in (self.get_pause_request_path(submission), self.get_resume_request_path(submission)):
            if path is None:
                continue
            try:
                path.unlink()
            except FileNotFoundError:
                continue

    def rewind_to_commit(self, submission: Submission, commit_oid: str) -> dict[str, str | int | None]:
        normalized_commit_oid = commit_oid.strip()
        if not normalized_commit_oid:
            raise ValueError("commit_oid is required")
        if not self.can_rewind(submission):
            raise ValueError("Submission must be paused or completed before rewinding")

        project_root = self.get_template_repo_path(submission)
        if project_root is None:
            raise FileNotFoundError("Submission workspace is not available")
        git_dir = project_root / ".git"
        if not git_dir.exists():
            raise FileNotFoundError("Git history is not available for this submission")

        history_payload = self.artifact_service.read_commit_history(submission)
        if history_payload.get("availability") != "available":
            raise FileNotFoundError("Git history is not available for this submission")

        commits = history_payload.get("commits", [])
        target_commit = next((commit for commit in commits if str(commit.get("oid", "")).strip() == normalized_commit_oid), None)
        if target_commit is None:
            raise FileNotFoundError(f"Commit not found: {normalized_commit_oid}")

        node_id = str(target_commit.get("node_id") or "").strip() or None
        phase = str(target_commit.get("phase") or "").strip() or None
        if not node_id or phase not in {"design", "implement"}:
            raise ValueError("Selected commit does not map to a requirement node and resumable phase")

        self._run_git(project_root, ["reset", "--hard", normalized_commit_oid])
        self._run_git(project_root, ["clean", "-fd"])

        rewound_history_payload = self.artifact_service.read_commit_history(submission)
        rewound_commits = rewound_history_payload.get("commits", [])
        rewound_index = next(
            (
                index
                for index, commit in enumerate(rewound_commits, start=1)
                if str(commit.get("oid", "")).strip() == normalized_commit_oid
            ),
            0,
        )
        if rewound_index <= 0:
            raise RuntimeError("Failed to confirm rewound commit in repository history")

        checkpoint = self.read_checkpoint(submission)
        checkpoint["last_completed_index"] = rewound_index
        checkpoint["completed"] = self._build_checkpoint_completed_entries(rewound_commits)
        checkpoint["paused"] = False
        checkpoint["rewind_target"] = {
            "commit_oid": normalized_commit_oid,
            "node_id": node_id,
            "phase": phase,
            "commit_index": rewound_index,
        }
        checkpoint["resume_requires_restart"] = True
        self.write_checkpoint(submission, checkpoint)

        historic_visual_events = self.read_visual_events(submission)
        self._stop_runner_container(submission.id)
        self._clear_execution_artifacts(submission)
        self._rebuild_runner_events_from_commit_history(
            submission,
            rewound_commits,
            historic_visual_events=historic_visual_events,
            target_node_id=node_id,
            target_phase=phase,
        )
        self._rebuild_traceability_store(submission)
        self._mark_rewound_paused(submission, node_id=node_id, phase=phase, commit_oid=normalized_commit_oid)

        return {
            "commit_oid": normalized_commit_oid,
            "node_id": node_id,
            "phase": phase,
            "commit_index": rewound_index,
        }

    def checkpoint_requires_restart(self, submission: Submission) -> bool:
        checkpoint = self.read_checkpoint(submission)
        return bool(checkpoint.get("resume_requires_restart"))

    def clear_checkpoint_restart_flag(self, submission: Submission) -> None:
        checkpoint = self.read_checkpoint(submission)
        if not checkpoint.get("resume_requires_restart"):
            return
        checkpoint["resume_requires_restart"] = False
        self.write_checkpoint(submission, checkpoint)

    def set_checkpoint_restart_flag(self, submission: Submission) -> None:
        checkpoint = self.read_checkpoint(submission)
        checkpoint["resume_requires_restart"] = True
        self.write_checkpoint(submission, checkpoint)

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
            can_pause=self.can_pause(submission),
            can_resume=self.can_resume(submission),
            pause_available=bool(self.get_pause_request_path(submission)),
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

    def read_visual_events(self, submission: Submission) -> list[SubmissionVisualEvent]:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if not workspace_path:
            return []

        runner_events_path = workspace_path / "artifacts" / "runner-events.jsonl"
        if not runner_events_path.exists():
            return []

        visual_events: list[SubmissionVisualEvent] = []
        for raw_line in runner_events_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(parsed, dict):
                continue
            if str(parsed.get("type", "")).strip() == "runner_state":
                continue
            if str(parsed.get("type", "")).strip() != "requirement_state":
                continue

            node_id = str(parsed.get("node_id", "")).strip()
            phase = str(parsed.get("phase", "")).strip()
            status = str(parsed.get("status", "")).strip()
            timestamp = str(parsed.get("timestamp", "")).strip()
            message = str(parsed.get("message", "")).strip() or None

            if not node_id or phase not in {"design", "implement", "test"} or status not in {"completed", "passed", "failed"} or not timestamp:
                continue

            visual_events.append(
                SubmissionVisualEvent(
                    type="requirement_state",
                    node_id=node_id,
                    phase=phase,
                    status=status,
                    timestamp=timestamp,
                    message=message,
                )
            )
        return visual_events

    def read_runner_events(self, submission: Submission) -> list[SubmissionRunnerEvent]:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if not workspace_path:
            return []

        runner_events_path = workspace_path / "artifacts" / "runner-events.jsonl"
        if not runner_events_path.exists():
            return []

        runner_events: list[SubmissionRunnerEvent] = []
        for raw_line in runner_events_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(parsed, dict):
                continue
            if str(parsed.get("type", "")).strip() != "runner_state":
                continue

            state = str(parsed.get("state", "")).strip()
            timestamp = str(parsed.get("timestamp", "")).strip()
            message = str(parsed.get("message", "")).strip() or None
            if state not in {"paused", "resumed"} or not timestamp:
                continue
            runner_events.append(
                SubmissionRunnerEvent(
                    type="runner_state",
                    state=state,
                    timestamp=timestamp,
                    message=message,
                )
            )
        return runner_events

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

    def update_status(self, submission: Submission, status: SubmissionStatus, failure_reason: str | None = None) -> None:
        submission.status = status.value
        submission.failure_reason = failure_reason
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)

    @staticmethod
    def can_pause(submission: Submission) -> bool:
        return submission.status == SubmissionStatus.RUNNING.value

    @staticmethod
    def can_resume(submission: Submission) -> bool:
        return submission.status == SubmissionStatus.PAUSED.value

    @staticmethod
    def can_rewind(submission: Submission) -> bool:
        return submission.status in {
            SubmissionStatus.PAUSED.value,
            SubmissionStatus.PASSED.value,
            SubmissionStatus.FAILED.value,
        }

    @staticmethod
    def _read_text(path: Path) -> str:
        if not path.is_file():
            return ""
        return path.read_text(encoding="utf-8")

    def _clear_execution_artifacts(self, submission: Submission) -> None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        artifacts_dir = workspace_path / "artifacts"
        for filename in [
            "stdout.log",
            "stderr.log",
            "result.json",
            "runner-events.jsonl",
            "traceability-events.jsonl",
            "pause.request.json",
            "resume.request.json",
        ]:
            target = artifacts_dir / filename
            if target.exists():
                target.unlink()
        event_log_path = self.get_event_log_path(submission)
        if event_log_path.exists():
            event_log_path.unlink()

    def _rebuild_runner_events_from_commit_history(
        self,
        submission: Submission,
        commits: list[dict],
        *,
        historic_visual_events: list[SubmissionVisualEvent] | None = None,
        target_node_id: str | None = None,
        target_phase: str | None = None,
    ) -> None:
        workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
        if workspace_path is None:
            raise FileNotFoundError("Submission workspace is not available")
        runner_events_path = workspace_path / "artifacts" / "runner-events.jsonl"
        runner_events_path.parent.mkdir(parents=True, exist_ok=True)
        lines: list[str] = []
        latest_test_event_by_node: dict[str, SubmissionVisualEvent] = {}
        for event in historic_visual_events or []:
            if event.phase != "test":
                continue
            latest_test_event_by_node[event.node_id] = event
        for commit in commits:
            node_id = str(commit.get("node_id") or "").strip()
            phase = str(commit.get("phase") or "").strip()
            timestamp = str(commit.get("committed_at") or "").strip()
            message = str(commit.get("summary") or commit.get("message") or "").strip() or None
            if not node_id or phase not in {"design", "implement"} or not timestamp:
                continue
            payload = {
                "type": "requirement_state",
                "node_id": node_id,
                "phase": phase,
                "status": "completed",
                "timestamp": timestamp,
                "message": message,
            }
            lines.append(json.dumps(payload, ensure_ascii=True))
            if phase != "implement" or not node_id:
                continue
            if target_node_id == node_id and target_phase == "implement":
                continue
            test_event = latest_test_event_by_node.get(node_id)
            if test_event is None:
                continue
            lines.append(
                json.dumps(
                    {
                        "type": "requirement_state",
                        "node_id": test_event.node_id,
                        "phase": test_event.phase,
                        "status": test_event.status,
                        "timestamp": test_event.timestamp,
                        "message": test_event.message,
                    },
                    ensure_ascii=True,
                )
            )
        runner_events_path.write_text(("\n".join(lines) + "\n") if lines else "", encoding="utf-8")

    def _rebuild_traceability_store(self, submission: Submission) -> None:
        payload = self.read_submission_task_documents(submission)
        requirements_yaml = payload.get("requirements_yaml", "").strip()
        if requirements_yaml:
            self.write_submission_traceability_store(submission, requirements_yaml)

    @staticmethod
    def _build_checkpoint_completed_entries(commits: list[dict]) -> list[dict[str, int | str | None]]:
        completed_entries: list[dict[str, int | str | None]] = []
        for index, commit in enumerate(commits, start=1):
            completed_entries.append(
                {
                    "index": index,
                    "node_id": str(commit.get("node_id") or "").strip() or None,
                    "phase": str(commit.get("phase") or "").strip() or None,
                }
            )
        return completed_entries

    def _mark_rewound_paused(self, submission: Submission, *, node_id: str, phase: str, commit_oid: str) -> None:
        submission.status = SubmissionStatus.PAUSED.value
        submission.started_at = None
        submission.finished_at = None
        submission.score = None
        submission.passed_count = 0
        submission.failed_count = 0
        submission.stdout_path = None
        submission.stderr_path = None
        submission.result_path = None
        submission.failure_reason = None
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)
        self.update_steps(
            submission,
            self.build_step_states(
                active_key="start_agent",
                completed={"deploy_agent"},
                description=f"Paused at rewound checkpoint {node_id} ({phase})",
            ),
        )
        self.append_step_event(
            submission.id,
            step_key="start_agent",
            message=f"Workspace rewound to commit {commit_oid[:7]} at {node_id} ({phase})",
            status="info",
        )

    @staticmethod
    def _stop_runner_container(submission_id: str) -> None:
        try:
            DockerManager().remove_submission_container(submission_id)
        except Exception:  # noqa: BLE001
            return

    @staticmethod
    def _run_git(project_root: Path, args: list[str]) -> str:
        completed = subprocess.run(
            ["git", *args],
            cwd=str(project_root),
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if completed.returncode != 0:
            stderr = completed.stderr.strip() or completed.stdout.strip() or "git command failed"
            raise RuntimeError(stderr)
        return completed.stdout

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
