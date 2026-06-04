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
        submission = submission_service.get_submission(submission_id)
        workspace_path = self.assembler.assemble(submission, requirement)
        submission_service.mark_running(submission, workspace_path)
        submission_service.update_steps(
            submission,
            submission_service.build_step_states(active_key="deploy_agent", description="Preparing workspace"),
        )

        manager = DockerManager()
        stdout_path = workspace_path / "artifacts" / "stdout.log"
        stderr_path = workspace_path / "artifacts" / "stderr.log"
        result_path = workspace_path / "artifacts" / "result.json"

        container = None
        try:
            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(active_key="deploy_agent", description="Creating runner container"),
            )
            container = manager.create_container(submission.id, workspace_path)
            manager.start_container(container)

            submission = submission_service.get_submission(submission_id)
            submission_service.update_steps(
                submission,
                submission_service.build_step_states(
                    active_key="start_agent",
                    completed={"deploy_agent"},
                    description="Starting uploaded agent",
                ),
            )

            exit_result = container.wait(timeout=self.settings.runner_timeout_seconds + 30)
            stdout, stderr = manager.collect_logs(container)
            stdout_path.write_text(stdout, encoding="utf-8")
            stderr_path.write_text(stderr, encoding="utf-8")

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
            status = SubmissionStatus.PASSED if parsed["failed"] == 0 and exit_result.get("StatusCode", 1) == 0 else SubmissionStatus.FAILED
            failure_reason = None if status == SubmissionStatus.PASSED else "Runner exited with test failures or runtime errors"
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
        except (RuntimeError, DockerException, FileNotFoundError, TimeoutError) as exc:
            submission = submission_service.get_submission(submission_id)
            if stdout_path.exists() is False:
                stdout_path.write_text("", encoding="utf-8")
            if stderr_path.exists() is False:
                stderr_path.write_text(str(exc), encoding="utf-8")
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
            if container is not None:
                try:
                    manager.remove_container(container)
                except DockerException:
                    pass
