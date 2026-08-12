"""Lifecycle service for immutable agent submissions and their run creation."""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.enums import AgentSourceType, RuntimeType, SubmissionStatus
from app.models.requirement import Requirement
from app.models.run import Run
from app.models.submission import Submission
from app.models.user import User
from app.services.model_provider_service import ModelProviderService
from app.services.requirement_catalog import RequirementCatalogService
from app.services.runtime_path_service import RuntimePathService
from app.services.submission_service import DEFAULT_STEPS, RunService
from app.services.user_task_service import UserTaskService


class AgentSubmissionService:
    def __init__(self, db: Session):
        self.db = db
        self.runtime_paths = RuntimePathService()
        self.settings = self.runtime_paths.settings
        self.model_providers = ModelProviderService(self.settings.runtime_config_path)

    def create(
        self,
        *,
        user_id: str,
        requirement_id: str | None,
        competition_id: str | None,
        runtime: RuntimeType,
        catalog: str,
        upload: UploadFile | None,
        display_name: str | None,
        model_name: str | None,
        agent_source: AgentSourceType,
        task_type: str | None = None,
    ) -> Submission:
        user = self._get_user(user_id)
        normalized_catalog = catalog.strip().lower()
        normalized_competition_id = (competition_id or "").strip().lower() or None
        normalized_requirement_id = (requirement_id or "").strip() or None
        if agent_source == AgentSourceType.BUILTIN_OCTOS_AGENT:
            raise ValueError("Built-in Octos agent is temporarily unavailable")
        if normalized_catalog == "competition":
            if not normalized_competition_id:
                raise ValueError("competition_id is required for a competition submission")
            competitions = RequirementCatalogService.for_catalog(self.db, "competition").list_competitions()
            if not any(item.id == normalized_competition_id for item in competitions):
                raise LookupError(f"Competition '{normalized_competition_id}' not found")
            # The database's legacy non-null physical column is retained for
            # backwards-compatible app.db upgrades; code uses competition_id.
            normalized_requirement_id = f"{normalized_competition_id}--__agent__"
        else:
            if not normalized_requirement_id:
                raise ValueError("A requirement id is required for a Playground submission")
            if normalized_catalog == "my_tasks":
                _task, requirement = UserTaskService(self.db).get_owned_task_for_submission(user, normalized_requirement_id)
            else:
                RequirementCatalogService.for_catalog(self.db, normalized_catalog).sync_to_db(normalized_requirement_id)
                requirement = self.db.get(Requirement, normalized_requirement_id)
            if requirement is None:
                raise LookupError(f"Requirement '{normalized_requirement_id}' not found")
            if task_type and task_type.strip().lower() != str(requirement.category or "").strip().lower():
                raise ValueError("Task type does not match the selected requirement")

        submission_id = uuid.uuid4().hex[:12]
        submission = Submission(
            id=submission_id,
            user_id=user.id,
            display_name=self._normalize_display_name(display_name),
            model_name=self.model_providers.resolve_model(model_name).name,
            catalog=normalized_catalog,
            competition_id=normalized_competition_id,
            requirement_id=normalized_requirement_id,
            runtime=runtime.value,
            agent_source=agent_source.value,
            original_filename="",
            archive_path="",
        )
        submission_root = self.runtime_paths.get_submission_root(submission, username=user.username)
        submission_root.mkdir(parents=True, exist_ok=True)
        archive_path = submission_root / "agent.zip"
        if agent_source == AgentSourceType.BUILTIN_ARC_AGENT:
            if runtime != RuntimeType.PYTHON:
                raise ValueError("Built-in ARC agent only supports Python runtime")
            RunService._write_builtin_arc_agent_archive(archive_path)
            original_filename = "builtin-arc-agent.zip"
            RunService._validate_agent_archive(archive_path, runtime)
        else:
            if upload is None or not upload.filename or not upload.filename.lower().endswith(".zip"):
                raise ValueError("Only .zip uploads are supported")
            with archive_path.open("wb") as output:
                shutil.copyfileobj(upload.file, output)
            original_filename = upload.filename
            RunService._validate_agent_archive(archive_path, runtime)
        submission.original_filename = original_filename
        submission.archive_path = str(archive_path)
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)
        return submission

    def create_run(self, submission_id: str, user_id: str, *, requirement_id: str | None = None) -> Run:
        submission = self.get(submission_id, user_id)
        user = self._get_user(user_id)
        target_requirement_id = (requirement_id or submission.requirement_id or "").strip()
        if submission.catalog == "competition":
            if not submission.competition_id:
                raise ValueError("Competition submission is missing its competition id")
            latest_id = self.db.scalar(
                select(Submission.id)
                .where(Submission.user_id == user_id)
                .where(Submission.catalog == "competition")
                .where(Submission.competition_id == submission.competition_id)
                .order_by(desc(Submission.created_at))
                .limit(1)
            )
            if latest_id != submission.id:
                raise ValueError("Runs must use the latest saved agent submission for this competition")
            if not target_requirement_id.startswith(f"{submission.competition_id}--") or target_requirement_id.endswith("--__agent__"):
                raise ValueError("The selected task does not belong to this competition")
            RequirementCatalogService.for_catalog(self.db, "competition").sync_to_db(target_requirement_id)
        elif target_requirement_id != submission.requirement_id:
            raise ValueError("A Playground run must use the task selected for its submission")
        if self.db.get(Requirement, target_requirement_id) is None:
            raise LookupError(f"Requirement '{target_requirement_id}' not found")
        source_archive = Path(submission.archive_path)
        if not source_archive.is_file():
            raise FileNotFoundError("The submitted agent archive is no longer available")

        run_id = uuid.uuid4().hex[:12]
        run = Run(
            id=run_id,
            user_id=user.id,
            submission_id=submission.id,
            submission_display_name=submission.display_name,
            model_name=submission.model_name,
            original_filename=submission.original_filename,
            catalog=submission.catalog,
            competition_id=submission.competition_id,
            requirement_id=target_requirement_id,
            runtime=submission.runtime,
            agent_source=submission.agent_source,
            agent_archive_path="",
            status=SubmissionStatus.PENDING.value,
            steps_json=json.dumps([step.model_dump() for step in DEFAULT_STEPS]),
        )
        run_root = self.runtime_paths.get_submission_root(run, username=user.username)
        run_root.mkdir(parents=True, exist_ok=True)
        archive_path = run_root / "agent.zip"
        shutil.copy2(source_archive, archive_path)
        run.agent_archive_path = str(archive_path)
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def list(self, user_id: str, *, requirement_id: str | None = None, competition_id: str | None = None) -> list[Submission]:
        query = select(Submission).where(Submission.user_id == user_id).order_by(desc(Submission.created_at))
        if requirement_id:
            query = query.where(Submission.requirement_id == requirement_id)
        if competition_id:
            query = query.where(Submission.competition_id == competition_id)
        return self.db.scalars(query).all()

    def get(self, submission_id: str, user_id: str | None = None) -> Submission:
        submission = self.db.get(Submission, submission_id)
        if submission is None or (user_id is not None and submission.user_id != user_id):
            raise LookupError(f"Submission '{submission_id}' not found")
        return submission

    def delete(self, submission_id: str, user_id: str) -> None:
        submission = self.get(submission_id, user_id)
        active_run = self.db.scalar(
            select(Run.id)
            .where(Run.submission_id == submission.id)
            .where(Run.status.in_([
                SubmissionStatus.PENDING.value,
                SubmissionStatus.RUNNING.value,
                SubmissionStatus.PAUSE_REQUESTED.value,
                SubmissionStatus.PAUSED.value,
                SubmissionStatus.RESUME_REQUESTED.value,
            ]))
            .limit(1)
        )
        if active_run:
            raise ValueError("Finish or cancel this submission's active run before deleting the submission")
        user = self._get_user(user_id)
        root = self.runtime_paths.get_submission_root(submission, username=user.username)
        if root.exists():
            RunService._remove_submission_runtime_directory(root)
        self.db.delete(submission)
        self.db.commit()

    def _get_user(self, user_id: str) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise LookupError(f"User '{user_id}' not found")
        return user

    @staticmethod
    def _normalize_display_name(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        if len(normalized) > 120:
            raise ValueError("Submission name must be 120 characters or fewer")
        return normalized or None
