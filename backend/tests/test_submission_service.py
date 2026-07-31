import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.enums import SubmissionStatus
from app.db.base import Base
from app.models.submission import Submission
from app.models.notification import Notification
from app.services.submission_service import SubmissionService


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


if __name__ == "__main__":
    unittest.main()
