"""Lifecycle service for immutable agent submissions and their run creation."""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.core.enums import AgentSourceType, RuntimeType, SubmissionStatus
from app.models.requirement import Requirement
from app.models.competition_account import CompetitionEntry, Team, TeamMembership
from app.models.run import Run
from app.models.submission import Submission
from app.models.user import User
from app.services.model_provider_service import ModelProviderService
from app.services.requirement_catalog import RequirementCatalogService
from app.services.runtime_path_service import RuntimePathService
from app.services.submission_service import DEFAULT_STEPS, RunService
from app.services.user_task_service import UserTaskService
from app.services.competition_access_service import CompetitionAccessService


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
        competition_entry: CompetitionEntry | None = None
        if agent_source == AgentSourceType.BUILTIN_OCTOS_AGENT:
            raise ValueError("Built-in Octos agent is temporarily unavailable")
        if normalized_catalog == "competition":
            if not normalized_competition_id:
                raise ValueError("competition_id is required for a competition submission")
            competitions = RequirementCatalogService.for_catalog(self.db, "competition").list_competitions()
            if not any(item.id == normalized_competition_id for item in competitions):
                raise LookupError(f"Competition '{normalized_competition_id}' not found")
            CompetitionAccessService(self.db).require_access(user, normalized_competition_id)
            competition_entry = self._competition_entry_for_user(user, normalized_competition_id)
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
            competition_entry_id=competition_entry.id if competition_entry else None,
            competition_owner_display_name=competition_entry.display_name if competition_entry else None,
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
        submission = self.get(submission_id, user_id, allow_team_entry=True)
        user = self._get_user(user_id)
        target_requirement_id = (requirement_id or submission.requirement_id or "").strip()
        if submission.catalog == "competition":
            if not submission.competition_id:
                raise ValueError("Competition submission is missing its competition id")
            CompetitionAccessService(self.db).require_access(user, submission.competition_id)
            latest_id = self.db.scalar(
                select(Submission.id)
                .where(Submission.catalog == "competition")
                .where(Submission.competition_id == submission.competition_id)
                .where(
                    Submission.competition_entry_id == submission.competition_entry_id
                    if submission.competition_entry_id
                    else Submission.user_id == submission.user_id
                )
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
            competition_entry_id=submission.competition_entry_id,
            competition_owner_display_name=submission.competition_owner_display_name,
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
        membership = self.db.scalar(select(TeamMembership).where(TeamMembership.user_id == user_id))
        owner_filter = Submission.user_id == user_id
        if membership:
            team_entry_ids = select(CompetitionEntry.id).where(CompetitionEntry.team_id == membership.team_id)
            owner_filter = or_(owner_filter, Submission.competition_entry_id.in_(team_entry_ids))
        query = select(Submission).where(owner_filter).order_by(desc(Submission.created_at))
        if requirement_id:
            query = query.where(Submission.requirement_id == requirement_id)
        if competition_id:
            query = query.where(Submission.competition_id == competition_id)
        return self.db.scalars(query).all()

    def get(self, submission_id: str, user_id: str | None = None, *, allow_team_entry: bool = False) -> Submission:
        submission = self.db.get(Submission, submission_id)
        if submission is None:
            raise LookupError(f"Submission '{submission_id}' not found")
        if user_id is not None and submission.user_id != user_id:
            if not allow_team_entry or not self._user_can_access_team_entry(user_id, submission.competition_entry_id):
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

    def delete_many(self, submission_ids: list[str], user_id: str) -> None:
        """Delete a bounded batch of owned agent snapshots after validating all of them."""
        unique_ids = list(dict.fromkeys(item.strip() for item in submission_ids if item and item.strip()))
        if not unique_ids:
            raise ValueError("Choose at least one submission to delete")

        submissions = [self.get(submission_id, user_id) for submission_id in unique_ids]
        active_statuses = [
            SubmissionStatus.PENDING.value,
            SubmissionStatus.RUNNING.value,
            SubmissionStatus.PAUSE_REQUESTED.value,
            SubmissionStatus.PAUSED.value,
            SubmissionStatus.RESUME_REQUESTED.value,
        ]
        active_run = self.db.scalar(
            select(Run.id)
            .where(Run.submission_id.in_(unique_ids))
            .where(Run.status.in_(active_statuses))
            .limit(1)
        )
        if active_run:
            raise ValueError("Finish or cancel every selected submission's active run before deleting it")

        user = self._get_user(user_id)
        roots = [self.runtime_paths.get_submission_root(submission, username=user.username) for submission in submissions]
        for root in roots:
            if root.exists():
                RunService._remove_submission_runtime_directory(root)
        for submission in submissions:
            self.db.delete(submission)
        self.db.commit()

    def _get_user(self, user_id: str) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise LookupError(f"User '{user_id}' not found")
        return user

    def _competition_entry_for_user(self, user: User, competition_id: str) -> CompetitionEntry:
        membership = self.db.scalar(select(TeamMembership).where(TeamMembership.user_id == user.id))
        if membership:
            team = self.db.get(Team, membership.team_id)
            if team is None:
                raise LookupError("Your team is no longer available")
            entry = self.db.scalar(
                select(CompetitionEntry).where(
                    CompetitionEntry.competition_id == competition_id,
                    CompetitionEntry.team_id == team.id,
                )
            )
            if entry is None:
                entry = CompetitionEntry(
                    competition_id=competition_id,
                    owner_kind="team",
                    team_id=team.id,
                    display_name=team.name,
                )
                self.db.add(entry)
                self.db.flush()
            return entry
        entry = self.db.scalar(
            select(CompetitionEntry).where(
                CompetitionEntry.competition_id == competition_id,
                CompetitionEntry.user_id == user.id,
            )
        )
        if entry is None:
            entry = CompetitionEntry(
                competition_id=competition_id,
                owner_kind="user",
                user_id=user.id,
                display_name=user.display_name or user.username,
            )
            self.db.add(entry)
            self.db.flush()
        return entry

    def _user_can_access_team_entry(self, user_id: str, entry_id: str | None) -> bool:
        if not entry_id:
            return False
        membership = self.db.scalar(select(TeamMembership).where(TeamMembership.user_id == user_id))
        entry = self.db.get(CompetitionEntry, entry_id)
        return bool(membership and entry and entry.owner_kind == "team" and entry.team_id == membership.team_id)

    @staticmethod
    def _normalize_display_name(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.strip().split())
        if len(normalized) > 120:
            raise ValueError("Submission name must be 120 characters or fewer")
        return normalized or None
