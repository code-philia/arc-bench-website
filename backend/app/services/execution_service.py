import json
import time
from pathlib import Path

from docker.errors import DockerException, NotFound
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import SubmissionStatus
from app.db.session import SessionLocal
from app.models.requirement import Requirement
from app.models.user import User
from app.services.debug_log_service import DebugLogService
from app.services.docker_manager import DockerManager
from app.services.host_demo_preview_service import HostDemoPreviewService
from app.services.result_parser import ResultParser
from app.services.runtime_path_service import RuntimePathService
from app.services.submission_event_stream import SubmissionEventStream
from app.services.submission_service import SubmissionService
from app.services.workspace_assembler import WorkspaceAssembler


PAUSE_GRACE_SECONDS = 3.0
PAUSE_SIGTERM_GRACE_SECONDS = 1.5


class ExecutionService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        self.assembler = WorkspaceAssembler()
        self.result_parser = ResultParser()
        self.runtime_paths = RuntimePathService()

    def run_submission(self, submission_id: str) -> None:
        self._run_submission_internal(submission_id, reuse_workspace=False)

    def rerun_submission(self, submission_id: str) -> None:
        self._run_submission_internal(submission_id, reuse_workspace=True)

    def _run_submission_internal(self, submission_id: str, *, reuse_workspace: bool) -> None:
        db = SessionLocal()
        try:
            submission_service = SubmissionService(db)
            submission = submission_service.get_submission(submission_id)
            user = db.get(User, submission.user_id) if submission.user_id else None
            if not user:
                raise RuntimeError(f"User '{submission.user_id}' not found")
            requirement = db.get(Requirement, submission.requirement_id)
            if not requirement:
                raise RuntimeError(f"Requirement '{submission.requirement_id}' not found")
            self._run(db, submission_service, submission_id, requirement, user, reuse_workspace=reuse_workspace)
        finally:
            db.close()

    def _run(
        self,
        db: Session,
        submission_service: SubmissionService,
        submission_id: str,
        requirement: Requirement,
        user: User,
        *,
        reuse_workspace: bool,
    ) -> None:
        if requirement.category != "web":
            raise RuntimeError(f"Unsupported requirement category: {requirement.category}")

        submission = submission_service.get_submission(submission_id)
        workspace_path = self.runtime_paths.get_workspace_root(submission, username=user.username)
        start_agent_description = "Running uploaded agent"
        stdout_path = workspace_path / "artifacts" / "stdout.log"
        stderr_path = workspace_path / "artifacts" / "stderr.log"
        result_path = workspace_path / "artifacts" / "result.json"
        debug_log = DebugLogService(workspace_path)

        container = None
        manager = None
        active_step_key = "deploy_agent"
        completed_steps: set[str] = set()
        processed_runner_event_count = 0
        last_known_workspace_head_oid: str | None = None
        pause_notified = False
        pause_signal_sent = False
        pause_requested_at: float | None = None
        pause_signal_sent_at: float | None = None
        paused = False

        def emit_event(step_key: str, message: str, status: str = "info") -> None:
            submission_service.append_step_event(submission_id, step_key=step_key, message=message, status=status)

        def mark_paused(reason: str) -> None:
            nonlocal paused
            paused = True
            submission_service.update_status(
                submission_service.get_submission(submission_id),
                SubmissionStatus.PAUSED,
                failure_reason=reason,
            )

        def resolve_workspace_head_oid() -> str | None:
            project_root = workspace_path / "template"
            git_dir = project_root / ".git"
            if not project_root.is_dir() or not git_dir.exists():
                return None
            try:
                return submission_service._run_git(project_root, ["rev-parse", "HEAD"]).strip()  # noqa: SLF001
            except RuntimeError:
                return None

        def import_runner_events() -> list[dict]:
            nonlocal last_known_workspace_head_oid, processed_runner_event_count
            runner_events_path = workspace_path / "artifacts" / "runner-events.jsonl"
            if not runner_events_path.exists():
                return []
            imported_events: list[dict] = []
            refresh_flags = {
                "submission": False,
                "logs": False,
                "commit_history": False,
                "traceability_selected": False,
                "traceability_all": False,
                "preview": False,
            }
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
                refresh_flags["logs"] = True
                event_type = str(event.get("type", "")).strip()
                if event_type == "requirement_state":
                    refresh_flags["submission"] = True
                elif event_type == "runner_state":
                    refresh_flags["submission"] = True
                elif event_type in {"interface_upsert", "interface_status", "test_upsert"}:
                    refresh_flags["traceability_selected"] = True
                    refresh_flags["traceability_all"] = True
                elif event_type == "signal":
                    refresh_payload = event.get("refresh")
                    if isinstance(refresh_payload, dict):
                        for key in refresh_flags:
                            if bool(refresh_payload.get(key)):
                                refresh_flags[key] = True
                step_key = str(event.get("step_key", "")).strip()
                message = str(event.get("message", "")).strip()
                status = str(event.get("status", "info")).strip() or "info"
                if step_key in {"deploy_agent", "start_agent", "run_tests"} and message:
                    emit_event(step_key, message, status=status)
                    imported_events.append({"step_key": step_key, "message": message, "status": status})

            head_changed = False
            latest_head_oid = resolve_workspace_head_oid()
            if latest_head_oid and latest_head_oid != last_known_workspace_head_oid:
                head_changed = True
                last_known_workspace_head_oid = latest_head_oid

            if head_changed:
                refresh_flags["commit_history"] = True
                refresh_flags["preview"] = True
                HostDemoPreviewService.mark_stale(submission_id)
            if any(refresh_flags.values()):
                SubmissionEventStream.publish(
                    submission_id,
                    reason="runner_events",
                    submission=refresh_flags["submission"],
                    logs=refresh_flags["logs"],
                    commit_history=refresh_flags["commit_history"],
                    traceability_selected=refresh_flags["traceability_selected"],
                    traceability_all=refresh_flags["traceability_all"],
                    preview=refresh_flags["preview"],
                )
            return imported_events

        def refresh_running_steps(latest_events: list[dict]) -> None:
            nonlocal active_step_key, completed_steps
            if not latest_events:
                return

            event_step_keys = {str(event.get("step_key", "")).strip() for event in latest_events}

            if "run_tests" in event_step_keys:
                completed_steps = {"deploy_agent", "start_agent"}
                active_step_key = "run_tests"
                description = "Preparing and running tests"
            elif "start_agent" in event_step_keys:
                completed_steps = {"deploy_agent"}
                active_step_key = "start_agent"
                description = start_agent_description
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
            if reuse_workspace:
                existing_workspace_path = self.runtime_paths.resolve_existing_path(submission.workspace_path)
                if existing_workspace_path is None:
                    raise RuntimeError("Submission workspace is not available for rewind resume")
                workspace_path = existing_workspace_path
                debug_log = DebugLogService(workspace_path)
                manager = DockerManager()
                manager.remove_submission_container(submission_id)
                runner_events_path = workspace_path / "artifacts" / "runner-events.jsonl"
                if runner_events_path.exists():
                    processed_runner_event_count = len(runner_events_path.read_text(encoding="utf-8").splitlines())
                last_known_workspace_head_oid = resolve_workspace_head_oid()
                emit_event("deploy_agent", "Reusing rewound workspace")
                debug_log.append("backend", f"Reusing existing workspace at {workspace_path}")
                emit_event("deploy_agent", "Existing workspace is ready", status="success")
            else:
                emit_event("deploy_agent", "Preparing workspace")
                workspace_path = self.assembler.assemble(submission, requirement, user)
                debug_log = DebugLogService(workspace_path)
                debug_log.append("backend", f"Workspace assembled at {workspace_path}")
                emit_event("deploy_agent", "Workspace assembled", status="success")
                last_known_workspace_head_oid = resolve_workspace_head_oid()
            stdout_path = workspace_path / "artifacts" / "stdout.log"
            stderr_path = workspace_path / "artifacts" / "stderr.log"
            result_path = workspace_path / "artifacts" / "result.json"
            submission_service.mark_running(submission, workspace_path)
            HostDemoPreviewService.mark_stale(submission.id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="deploy_agent",
                    description="Reusing rewound workspace" if reuse_workspace else "Preparing workspace",
                ),
            )

            emit_event("deploy_agent", "Connecting to Docker daemon")
            debug_log.append("backend", "Connecting to Docker daemon")
            if manager is None:
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
            manager.remove_submission_container(submission_id)
            container = manager.create_container(
                submission.id,
                workspace_path,
                github_email=user.github_email,
                github_username=user.github_username,
                log_callback=lambda line: debug_log.append("docker-build", line),
            )
            debug_log.append("backend", f"Container created: name={container.name}, id={container.id}")
            emit_event("deploy_agent", f"Runner container created ({container.name})", status="success")
            manager.start_container(container)
            debug_log.append("backend", "Container start requested")
            emit_event("deploy_agent", "Runner container started", status="success")
            if reuse_workspace:
                submission_service.clear_checkpoint_restart_flag(submission_service.get_submission(submission_id))
            completed_steps = {"deploy_agent"}
            active_step_key = "start_agent"

            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="start_agent",
                    completed={"deploy_agent"},
                    description=start_agent_description,
                ),
            )
            emit_event("start_agent", start_agent_description)
            debug_log.append("backend", f"Waiting for container to exit with timeout={self.settings.runner_timeout_seconds + 30}s")
            wait_deadline = time.time() + self.settings.runner_timeout_seconds + 30
            exit_result = None
            while time.time() < wait_deadline:
                latest_events = import_runner_events()
                if latest_events:
                    refresh_running_steps(latest_events)
                current_status = submission_service.get_submission(submission_id).status
                if current_status == SubmissionStatus.PAUSE_REQUESTED.value:
                    if not pause_notified:
                        pause_notified = True
                        pause_requested_at = time.time()
                        emit_event("start_agent", "Pause requested; waiting for checkpoint", status="info")
                        submission_service.update_steps(
                            submission_service.get_submission(submission_id),
                            submission_service.build_step_states(
                                active_key="start_agent",
                                completed={"deploy_agent"},
                                description="Pausing current run",
                            ),
                        )
                        debug_log.append("backend", "Pause requested; waiting briefly for checkpoint flush")
                    checkpoint = submission_service.read_checkpoint(submission_service.get_submission(submission_id))
                    checkpoint_marked_paused = bool(checkpoint.get("paused"))
                    if not pause_signal_sent and pause_requested_at is not None and time.time() - pause_requested_at >= PAUSE_GRACE_SECONDS:
                        try:
                            exit_code, _ = manager.kill_agent_process(container)
                            debug_log.append("backend", f"Sent SIGTERM to agent main.py (pkill exit={exit_code})")
                            pause_signal_sent = True
                            pause_signal_sent_at = time.time()
                        except Exception as exc:  # noqa: BLE001
                            debug_log.append("backend", f"Failed to signal agent process: {exc}")
                    if checkpoint_marked_paused:
                        debug_log.append("backend", "Pause checkpoint detected in workspace")
                    if checkpoint_marked_paused or (
                        pause_signal_sent_at is not None and time.time() - pause_signal_sent_at >= PAUSE_SIGTERM_GRACE_SECONDS
                    ):
                        submission_service.set_checkpoint_restart_flag(submission_service.get_submission(submission_id))
                        mark_paused("Execution paused by user request")
                        debug_log.append("backend", "Execution paused cleanly; terminating runner session")
                        return
                    time.sleep(1)
                    continue
                try:
                    container.reload()
                except NotFound as exc:
                    if submission_service.checkpoint_requires_restart(submission_service.get_submission(submission_id)):
                        debug_log.append("backend", "Runner container removed for rewind restart")
                        return
                    raise RuntimeError("Runner container disappeared before completion") from exc
                if container.status == "exited":
                    exit_result = container.wait(timeout=5)
                    break
                time.sleep(1)
            if exit_result is None:
                raise TimeoutError("Runner did not finish before timeout")
            if paused or submission_service.get_submission(submission_id).status == SubmissionStatus.PAUSED.value:
                debug_log.append("backend", "Skipping test execution because submission is paused")
                return
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
            if str(exc) == "Execution paused by user request":
                debug_log.append("backend", "Execution paused cleanly")
                return
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
