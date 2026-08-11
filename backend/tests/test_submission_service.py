import os
import stat
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.enums import SubmissionStatus
from app.db.base import Base
from app.models.notification import Notification
from app.models.requirement import Requirement
from app.models.run import Run
from app.models.submission import Submission
from app.models.user import User
from app.services.agent_submission_service import AgentSubmissionService
from app.services.submission_service import RunService


class SubmissionAndRunServiceTests(unittest.TestCase):
    def test_mark_running_records_workspace_on_the_run(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            engine = create_engine("sqlite://")
            Base.metadata.create_all(engine)
            session = sessionmaker(bind=engine)()
            run = Run(
                id="run-under-test", submission_id="snapshot-1", requirement_id="demo-task", runtime="python",
                agent_source="upload", agent_archive_path=str(Path(temp_dir) / "agent.zip"), status=SubmissionStatus.PENDING.value,
            )
            session.add(run)
            session.commit()

            workspace = Path(temp_dir) / "workspace"
            RunService(session).mark_running(run, workspace)

            session.refresh(run)
            self.assertEqual(run.status, SubmissionStatus.RUNNING.value)
            self.assertEqual(run.workspace_path, str(workspace))
            self.assertIsNotNone(run.stdout_path)
            session.close()
            engine.dispose()

    def test_finalize_creates_notification_linked_to_the_run(self) -> None:
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        session = sessionmaker(bind=engine)()
        run = Run(
            id="completed-run", user_id="user-under-test", submission_id="snapshot-1", requirement_id="demo-task",
            runtime="python", agent_source="upload", agent_archive_path="agent.zip", status=SubmissionStatus.RUNNING.value,
        )
        session.add(run)
        session.commit()

        RunService(session).finalize(
            run, status=SubmissionStatus.PASSED, passed_count=2, failed_count=0, score=100.0,
            stdout_path=None, stderr_path=None, result_path=None,
        )

        notification = session.query(Notification).filter_by(run_id=run.id).one()
        self.assertEqual(notification.kind, "completed")
        session.close()
        engine.dispose()

    def test_deleting_submission_keeps_completed_run_and_its_runtime(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "user-submissions"
            engine = create_engine("sqlite://")
            Base.metadata.create_all(engine)
            session = sessionmaker(bind=engine)()
            user = User(id="user-a", email="user-a@example.com", username="user-a", password_hash="hash")
            snapshot = Submission(
                id="competition-snapshot", user_id=user.id, catalog="competition", competition_id="demo",
                requirement_id="demo--__agent__", runtime="python", agent_source="upload",
                original_filename="agent.zip", archive_path="snapshot.zip",
            )
            run = Run(
                id="task-run", user_id=user.id, submission_id=snapshot.id, catalog="competition", competition_id="demo",
                requirement_id="demo--task-a", runtime="python", agent_source="upload", agent_archive_path="run.zip",
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

            service = AgentSubmissionService(session)
            service.settings.user_submissions_root = root
            service.runtime_paths.settings.user_submissions_root = root
            service.delete(snapshot.id, user.id)

            self.assertIsNone(session.get(Submission, snapshot.id))
            self.assertIsNotNone(session.get(Run, run.id))
            self.assertFalse(snapshot_dir.exists())
            self.assertTrue(run_dir.exists())
            session.close()
            engine.dispose()

    def test_creating_a_run_copies_snapshot_and_targets_its_task(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "user-submissions"
            engine = create_engine("sqlite://")
            Base.metadata.create_all(engine)
            session = sessionmaker(bind=engine)()
            user = User(id="user-a", email="user-a@example.com", username="user-a", password_hash="hash")
            archive = root / "user-a-user-a" / "snapshot" / "agent.zip"
            archive.parent.mkdir(parents=True)
            archive.write_bytes(b"agent")
            snapshot = Submission(
                id="snapshot", user_id=user.id, catalog="playground", requirement_id="task-a", runtime="python",
                agent_source="upload", original_filename="agent.zip", archive_path=str(archive),
            )
            requirement = Requirement(
                id="task-a", title="Task", category="web", summary="", test_runner="playwright",
                requirements_path="requirements.md", prerequisites_path="prerequisites.md", tests_path="tests",
                assets_path="assets", references_path="reference",
            )
            session.add_all([user, snapshot, requirement])
            session.commit()

            service = AgentSubmissionService(session)
            service.settings.user_submissions_root = root
            service.runtime_paths.settings.user_submissions_root = root
            run = service.create_run(snapshot.id, user.id)

            self.assertEqual(run.submission_id, snapshot.id)
            self.assertEqual(run.requirement_id, "task-a")
            self.assertTrue(Path(run.agent_archive_path).is_file())
            self.assertNotEqual(Path(run.agent_archive_path), archive)
            session.close()
            engine.dispose()

    def test_competition_run_requires_the_latest_saved_agent(self) -> None:
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        session = sessionmaker(bind=engine)()
        user = User(id="user-a", email="user-a@example.com", username="user-a", password_hash="hash")
        now = datetime.utcnow()
        older = Submission(
            id="older", user_id=user.id, catalog="competition", competition_id="hackathon",
            requirement_id="hackathon--__agent__", runtime="python", agent_source="upload",
            original_filename="agent.zip", archive_path="missing.zip", created_at=now - timedelta(minutes=1),
        )
        latest = Submission(
            id="latest", user_id=user.id, catalog="competition", competition_id="hackathon",
            requirement_id="hackathon--__agent__", runtime="python", agent_source="upload",
            original_filename="agent.zip", archive_path="missing.zip", created_at=now,
        )
        session.add_all([user, older, latest])
        session.commit()

        with self.assertRaisesRegex(ValueError, "latest saved agent submission"):
            AgentSubmissionService(session).create_run(older.id, user.id, requirement_id="hackathon--task-a")
        session.close()
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
