from pathlib import Path

from docker.errors import DockerException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import SubmissionStatus
from app.db.session import SessionLocal
from app.models.requirement import Requirement
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

        container = None
        manager = None
        active_step_key = "deploy_agent"
        completed_steps: set[str] = set()
        try:
            submission_service.append_event_log(submission_id, "[deploy] Preparing workspace")
            workspace_path = self.assembler.assemble(submission, requirement)
            submission_service.append_event_log(submission_id, f"[ok] [deploy] Workspace prepared at {workspace_path}")
            stdout_path = workspace_path / "artifacts" / "stdout.log"
            stderr_path = workspace_path / "artifacts" / "stderr.log"
            result_path = workspace_path / "artifacts" / "result.json"
            submission_service.mark_running(submission, workspace_path)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(active_key="deploy_agent", description="Preparing workspace"),
            )

            submission_service.append_event_log(submission_id, "[deploy] Connecting to Docker daemon")
            manager = DockerManager()
            submission_service.append_event_log(submission_id, "[ok] [deploy] Docker daemon is reachable")
            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(active_key="deploy_agent", description="Creating runner container"),
            )
            submission_service.append_event_log(submission_id, "[deploy] Ensuring runner image is available")
            container = manager.create_container(submission.id, workspace_path)
            submission_service.append_event_log(submission_id, f"[ok] [deploy] Container created: {container.name}")
            manager.start_container(container)
            submission_service.append_event_log(submission_id, "[ok] [deploy] Container started")
            completed_steps = {"deploy_agent"}
            active_step_key = "start_agent"

            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="start_agent",
                    completed={"deploy_agent"},
                    description="Starting uploaded agent",
                ),
            )
            submission_service.append_event_log(submission_id, "[start] Waiting for runner process to complete")

            exit_result = container.wait(timeout=self.settings.runner_timeout_seconds + 30)
            submission_service.append_event_log(submission_id, f"[ok] [start] Runner process exited with status code {exit_result.get('StatusCode', 'unknown')}")
            completed_steps = {"deploy_agent", "start_agent"}
            active_step_key = "run_tests"
            stdout, stderr = manager.collect_logs(container)
            stdout_path.write_text(stdout, encoding="utf-8")
            stderr_path.write_text(stderr, encoding="utf-8")
            submission_service.append_event_log(submission_id, "[ok] [test] Runner stdout/stderr collected")

            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="run_tests",
                    completed={"deploy_agent", "start_agent"},
                    description="Collecting test results",
                ),
            )

            parsed = self.result_parser.parse(result_path)
            submission_service.append_event_log(submission_id, f"[ok] [test] Parsed test results: passed={parsed['passed']}, failed={parsed['failed']}, score={parsed['score']}")
            status = SubmissionStatus.PASSED if parsed["failed"] == 0 and exit_result.get("StatusCode", 1) == 0 else SubmissionStatus.FAILED
            failure_reason = None if status == SubmissionStatus.PASSED else "Runner exited with test failures or runtime errors"
            if status == SubmissionStatus.PASSED:
                submission_service.append_event_log(submission_id, "[ok] [test] Submission finished successfully")
            else:
                submission_service.append_event_log(submission_id, f"[test] Submission failed: {failure_reason}")
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
        except Exception as exc:  # noqa: BLE001
            submission = submission_service.get_submission(submission_id)
            log_prefix = {
                "deploy_agent": "deploy",
                "start_agent": "start",
                "run_tests": "test",
            }.get(active_step_key, "system")
            submission_service.append_event_log(submission_id, f"[{log_prefix}] Failure: {exc}")
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
        finally:
            if manager is not None and container is not None:
                try:
                    submission_service.append_event_log(submission_id, "[deploy] Removing container")
                    manager.remove_container(container)
                    submission_service.append_event_log(submission_id, "[ok] [deploy] Container removed")
                except DockerException:
                    pass
