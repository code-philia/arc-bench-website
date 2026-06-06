import json
import time
from pathlib import Path

from docker.errors import DockerException, NotFound
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import SubmissionStatus
from app.db.session import SessionLocal
from app.models.requirement import Requirement
from app.services.debug_log_service import DebugLogService
from app.services.docker_manager import DockerManager
from app.services.result_parser import ResultParser
from app.services.submission_service import SubmissionService
from app.services.workspace_assembler import WorkspaceAssembler


class ExecutionService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.assembler = WorkspaceAssembler()
        self.result_parser = ResultParser()

    def run_submission(self, submission_id: str) -> None:
        db = SessionLocal()
        try:
            submission_service = SubmissionService(db)
            submission = submission_service.get_submission(submission_id)
            requirement = db.get(Requirement, submission.requirement_id)
            if not requirement:
                raise RuntimeError(f"Requirement '{submission.requirement_id}' not found")
            self._run(db, submission_service, submission_id, requirement)
        finally:
            db.close()

    def _run(self, db: Session, submission_service: SubmissionService, submission_id: str, requirement: Requirement) -> None:
        if requirement.category != "web":
            raise RuntimeError(f"Unsupported requirement category: {requirement.category}")

        submission = submission_service.get_submission(submission_id)
        workspace_path = self.settings.workspaces_root / submission_id
        stdout_path = workspace_path / "artifacts" / "stdout.log"
        stderr_path = workspace_path / "artifacts" / "stderr.log"
        result_path = workspace_path / "artifacts" / "result.json"
        debug_log = DebugLogService(workspace_path)

        container = None
        manager = None
        active_step_key = "deploy_agent"
        completed_steps: set[str] = set()
        processed_runner_event_count = 0

        def emit_event(step_key: str, message: str, status: str = "info") -> None:
            submission_service.append_step_event(submission_id, step_key=step_key, message=message, status=status)

        def import_runner_events() -> list[dict]:
            nonlocal processed_runner_event_count
            runner_events_path = workspace_path / "artifacts" / "runner-events.jsonl"
            if not runner_events_path.exists():
                return []
            imported_events: list[dict] = []
            lines = runner_events_path.read_text(encoding="utf-8").splitlines()
            new_lines = lines[processed_runner_event_count:]
            processed_runner_event_count = len(lines)
            for raw_line in new_lines:
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except Exception:
                    debug_log.append("backend", f"Failed to parse runner event line: {line}")
                    continue
                step_key = str(event.get("step_key", "")).strip()
                message = str(event.get("message", "")).strip()
                status = str(event.get("status", "info")).strip() or "info"
                if step_key in {"deploy_agent", "start_agent", "run_tests"} and message:
                    emit_event(step_key, message, status=status)
                    imported_events.append({"step_key": step_key, "message": message, "status": status})
            return imported_events

        def refresh_running_steps(latest_events: list[dict]) -> None:
            nonlocal active_step_key, completed_steps
            if not latest_events:
                return
            latest_step = latest_events[-1]["step_key"]
            if latest_step == "run_tests":
                completed_steps = {"deploy_agent", "start_agent"}
                active_step_key = "run_tests"
                description = "Preparing and running tests"
            elif latest_step == "start_agent":
                completed_steps = {"deploy_agent"}
                active_step_key = "start_agent"
                description = "Running uploaded agent"
            else:
                completed_steps = set()
                active_step_key = "deploy_agent"
                description = "Preparing workspace"
            submission_service.update_steps(
                submission_service.get_submission(submission_id),
                submission_service.build_step_states(
                    active_key=active_step_key,
                    completed=completed_steps,
                    description=description,
                ),
            )

        try:
            debug_log.append("backend", f"Execution started for submission {submission_id}")
            debug_log.append("backend", f"Requirement category: {requirement.category}")
            emit_event("deploy_agent", "Preparing workspace")
            workspace_path = self.assembler.assemble(submission, requirement)
            debug_log = DebugLogService(workspace_path)
            debug_log.append("backend", f"Workspace assembled at {workspace_path}")
            emit_event("deploy_agent", "Workspace assembled", status="success")
            stdout_path = workspace_path / "artifacts" / "stdout.log"
            stderr_path = workspace_path / "artifacts" / "stderr.log"
            result_path = workspace_path / "artifacts" / "result.json"
            submission_service.mark_running(submission, workspace_path)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(active_key="deploy_agent", description="Preparing workspace"),
            )

            emit_event("deploy_agent", "Connecting to Docker daemon")
            debug_log.append("backend", "Connecting to Docker daemon")
            manager = DockerManager()
            debug_log.append("backend", "Docker daemon ping succeeded")
            emit_event("deploy_agent", "Docker daemon is reachable", status="success")
            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(active_key="deploy_agent", description="Creating runner container"),
            )
            emit_event("deploy_agent", "Preparing runner image")
            debug_log.append("backend", f"Ensuring runner image is available: {self.settings.runner_image}")
            container = manager.create_container(
                submission.id,
                workspace_path,
                log_callback=lambda line: debug_log.append("docker-build", line),
            )
            debug_log.append("backend", f"Container created: name={container.name}, id={container.id}")
            emit_event("deploy_agent", f"Runner container created ({container.name})", status="success")
            manager.start_container(container)
            debug_log.append("backend", "Container start requested")
            emit_event("deploy_agent", "Runner container started", status="success")
            completed_steps = {"deploy_agent"}
            active_step_key = "start_agent"

            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="start_agent",
                    completed={"deploy_agent"},
                    description="Running uploaded agent",
                ),
            )
            emit_event("start_agent", "Running uploaded agent")
            debug_log.append("backend", f"Waiting for container to exit with timeout={self.settings.runner_timeout_seconds + 30}s")
            wait_deadline = time.time() + self.settings.runner_timeout_seconds + 30
            exit_result = None
            while time.time() < wait_deadline:
                latest_events = import_runner_events()
                if latest_events:
                    refresh_running_steps(latest_events)
                try:
                    container.reload()
                except NotFound as exc:
                    raise RuntimeError("Runner container disappeared before completion") from exc
                if container.status == "exited":
                    exit_result = container.wait(timeout=5)
                    break
                time.sleep(1)
            if exit_result is None:
                raise TimeoutError("Runner did not finish before timeout")
            debug_log.append("backend", f"Container exited with result={exit_result}")
            latest_events = import_runner_events()
            if latest_events:
                refresh_running_steps(latest_events)
            emit_event("run_tests", "Collecting test artifacts")
            stdout, stderr = manager.collect_logs(container)
            if stdout and not stdout_path.exists():
                stdout_path.write_text(stdout, encoding="utf-8")
            if stderr and not stderr_path.exists():
                stderr_path.write_text(stderr, encoding="utf-8")
            debug_log.append("backend", f"Collected container logs: stdout_bytes={len(stdout.encode('utf-8'))}, stderr_bytes={len(stderr.encode('utf-8'))}")
            emit_event("run_tests", "Test artifacts collected", status="success")

            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="run_tests",
                    completed={"deploy_agent", "start_agent"},
                    description="Preparing and running tests",
                ),
            )

            parsed = self.result_parser.parse(result_path)
            debug_log.append("backend", f"Parsed result file at {result_path}: {parsed}")
            emit_event(
                "run_tests",
                f"Test results parsed: passed={parsed['passed']}, failed={parsed['failed']}, score={parsed['score']}",
                status="success",
            )
            status = SubmissionStatus.PASSED if parsed["failed"] == 0 and exit_result.get("StatusCode", 1) == 0 else SubmissionStatus.FAILED
            failure_reason = None if status == SubmissionStatus.PASSED else "Runner exited with test failures or runtime errors"
            if status == SubmissionStatus.PASSED:
                emit_event("run_tests", "Submission finished successfully", status="success")
            else:
                emit_event("run_tests", failure_reason, status="error")
            submission_service.update_steps(
                submission_service.get_submission(submission_id),
                submission_service.build_step_states(completed={"deploy_agent", "start_agent", "run_tests"}),
            )
            submission_service.finalize(
                submission_service.get_submission(submission_id),
                status=status,
                passed_count=parsed["passed"],
                failed_count=parsed["failed"],
                score=parsed["score"],
                stdout_path=stdout_path,
                stderr_path=stderr_path,
                result_path=result_path if result_path.exists() else None,
                failure_reason=failure_reason,
            )
            debug_log.append("backend", f"Submission finalized with status={status.value}, score={parsed['score']}")
        except Exception as exc:  # noqa: BLE001
            submission = submission_service.get_submission(submission_id)
            emit_event(active_step_key, str(exc), status="error")
            debug_log.append("backend", f"Execution failed during {active_step_key}: {exc}")
            stdout_path.parent.mkdir(parents=True, exist_ok=True)
            if stdout_path.exists() is False:
                stdout_path.write_text("", encoding="utf-8")
            if stderr_path.exists() is False:
                stderr_path.write_text(str(exc), encoding="utf-8")
            submission_service.update_steps(
                submission,
                submission_service.build_failed_step_states(
                    failed_key=active_step_key,
                    reason=str(exc),
                    completed=completed_steps,
                ),
            )
            submission_service.finalize(
                submission,
                status=SubmissionStatus.FAILED,
                passed_count=0,
                failed_count=0,
                score=0.0,
                stdout_path=stdout_path,
                stderr_path=stderr_path,
                result_path=result_path if result_path.exists() else None,
                failure_reason=str(exc),
            )
            debug_log.append("backend", "Failure state persisted to database")
        finally:
            if manager is not None and container is not None:
                try:
                    debug_log.append("backend", f"Removing container {container.name}")
                    manager.remove_container(container)
                    debug_log.append("backend", "Container removed")
                except DockerException:
                    debug_log.append("backend", "Container removal failed with DockerException")
                    pass
