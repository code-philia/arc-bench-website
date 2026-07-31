import tempfile
import unittest
import os
import stat
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.enums import SubmissionStatus
from app.db.base import Base
from app.models.submission import Submission
from app.models.notification import Notification
from app.services.submission_service import SubmissionService
from app.models.user import User


class SubmissionServiceTests(unittest.TestCase):
    def test_mark_running_records_workspace_without_finalizing_notification(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = create_engine("sqlite://")
            Base.metadata.create_all(engine)
            session = sessionmaker(bind=engine)()
            submission = Submission(
                id="submission-under-test",
                requirement_id="demo-task",
                runtime="python",
                agent_source="upload",
                original_filename="agent.zip",
                archive_path=str(Path(temp_dir) / "agent.zip"),
                status=SubmissionStatus.PENDING.value,
            )
            session.add(submission)
            session.commit()

            workspace = Path(temp_dir) / "workspace"
            SubmissionService(session).mark_running(submission, workspace)

            session.refresh(submission)
            self.assertEqual(submission.status, SubmissionStatus.RUNNING.value)
            self.assertEqual(submission.workspace_path, str(workspace))
            self.assertIsNotNone(submission.stdout_path)
            session.close()
            engine.dispose()

    def test_finalize_creates_completion_notification(self) -> None:
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        session = sessionmaker(bind=engine)()
        submission = Submission(
            id="completed-submission",
            user_id="user-under-test",
            requirement_id="demo-task",
            runtime="python",
            agent_source="upload",
            original_filename="agent.zip",
            archive_path="agent.zip",
            status=SubmissionStatus.RUNNING.value,
        )
        session.add(submission)
        session.commit()

        SubmissionService(session).finalize(
            submission,
            status=SubmissionStatus.PASSED,
            passed_count=2,
            failed_count=0,
            score=100.0,
            stdout_path=None,
            stderr_path=None,
            result_path=None,
        )

        notification = session.query(Notification).filter_by(submission_id=submission.id).one()
        self.assertEqual(notification.kind, "completed")
        self.assertEqual(notification.title, "Run completed")
        session.close()
        engine.dispose()

    def test_delete_submission_removes_only_its_canonical_runtime_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "user-submissions"
            engine = create_engine("sqlite://")
            Base.metadata.create_all(engine)
            session = sessionmaker(bind=engine)()
            user = User(id="user-a", email="user-a@example.com", username="user-a", password_hash="hash")
            snapshot = Submission(
                id="competition-snapshot",
                user_id=user.id,
                requirement_id="demo--__agent__",
                runtime="python",
                agent_source="upload",
                original_filename="agent.zip",
                archive_path=str(Path(temp_dir) / "untrusted-archive" / "agent.zip"),
                status=SubmissionStatus.READY.value,
            )
            run = Submission(
                id="task-run",
                user_id=user.id,
                requirement_id="demo--task-a",
                runtime="python",
                agent_source="upload",
                original_filename="agent.zip",
                archive_path=str(root / "user-a-user-a" / "task-run" / "agent.zip"),
                status=SubmissionStatus.PASSED.value,
            )
            session.add_all([user, snapshot, run])
            session.commit()

            snapshot_dir = root / "user-a-user-a" / snapshot.id
            run_dir = root / "user-a-user-a" / run.id
            snapshot_dir.mkdir(parents=True)
            run_dir.mkdir(parents=True)
            (snapshot_dir / "agent.zip").write_bytes(b"snapshot")
            (run_dir / "agent.zip").write_bytes(b"run")
            git_object = snapshot_dir / "workspace" / "template" / ".git" / "objects" / "00" / "object"
            git_object.parent.mkdir(parents=True)
            git_object.write_bytes(b"git-object")
            os.chmod(git_object, stat.S_IREAD)

            service = SubmissionService(session)
            service.settings.user_submissions_root = root
            service.runtime_paths.settings.user_submissions_root = root
            with patch.object(SubmissionService, "_stop_runner_container") as stop_runner:
                service.delete_submission(snapshot.id, user.id)

            stop_runner.assert_called_once_with(snapshot.id)

            self.assertIsNone(session.get(Submission, snapshot.id))
            self.assertIsNotNone(session.get(Submission, run.id))
            self.assertFalse(snapshot_dir.exists())
            self.assertTrue(run_dir.exists())
            session.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
