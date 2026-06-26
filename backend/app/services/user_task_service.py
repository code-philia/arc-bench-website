from __future__ import annotations

import re
import shutil
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User
from app.models.user_task import UserTask
from app.schemas.user_task import UserTaskCreateRequest, UserTaskDetail, UserTaskDraftResponse, UserTaskSummary


class UserTaskService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    def list_user_tasks(self, user: User) -> list[UserTaskSummary]:
        rows = self.db.scalars(
            select(UserTask).where(UserTask.owner_user_id == user.id).order_by(UserTask.updated_at.desc(), UserTask.created_at.desc())
        ).all()
        return [UserTaskSummary.model_validate(row, from_attributes=True) for row in rows]

    def get_user_task_detail(self, user: User, task_id: str) -> UserTaskDetail:
        task = self._get_owned_task(user, task_id)
        return UserTaskDetail(
            **UserTaskSummary.model_validate(task, from_attributes=True).model_dump(),
            yaml_content=Path(task.yaml_path).read_text(encoding="utf-8"),
            markdown_content=Path(task.markdown_path).read_text(encoding="utf-8"),
        )

    def create_draft(self, user: User) -> UserTaskDraftResponse:
        draft_id = f"draft_{uuid4().hex[:12]}"
        draft_dir = self._draft_dir(user, draft_id)
        (draft_dir / "reference").mkdir(parents=True, exist_ok=True)
        return UserTaskDraftResponse(
            draft_id=draft_id,
            references_base_url=f"/api/my-tasks/drafts/{draft_id}/reference/",
        )

    def save_draft_reference(self, user: User, draft_id: str, filename: str, content: bytes) -> str:
        safe_name = self._sanitize_filename(filename)
        if not safe_name:
            raise ValueError("Uploaded image filename is invalid")
        target_dir = self._draft_dir(user, draft_id) / "reference"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = self._unique_path(target_dir, safe_name)
        target_path.write_bytes(content)
        return target_path.name

    def create_user_task(self, user: User, payload: UserTaskCreateRequest) -> UserTaskDetail:
        task_id = f"task_{uuid4().hex[:12]}"
        task_dir = self._task_dir(user, task_id)
        task_dir.mkdir(parents=True, exist_ok=True)

        yaml_path = task_dir / "task.yaml"
        markdown_path = task_dir / "task.md"
        yaml_content = payload.yaml_content.strip() + "\n"
        markdown_content = payload.markdown_content.strip() + "\n"

        yaml_path.write_text(yaml_content, encoding="utf-8")
        markdown_path.write_text(markdown_content, encoding="utf-8")
        self._copy_draft_references(user, payload.draft_id, task_dir)

        task = UserTask(
            id=task_id,
            owner_user_id=user.id,
            title=payload.title.strip(),
            task_type=payload.task_type,
            summary=payload.summary.strip(),
            root_requirement_id=payload.root_requirement_id.strip(),
            node_count=payload.node_count,
            atomic_count=payload.atomic_count,
            yaml_path=str(yaml_path),
            markdown_path=str(markdown_path),
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return self.get_user_task_detail(user, task.id)

    def get_document(self, user: User, task_id: str, kind: str) -> tuple[str, str]:
        task = self._get_owned_task(user, task_id)
        if kind == "yaml":
            return Path(task.yaml_path).read_text(encoding="utf-8"), f"{task.id}.yaml"
        if kind == "markdown":
            return Path(task.markdown_path).read_text(encoding="utf-8"), f"{task.id}.md"
        raise LookupError("Unknown task document kind")

    def get_draft_reference_path(self, user: User, draft_id: str, asset_path: str) -> Path:
        reference_root = (self._draft_dir(user, draft_id) / "reference").resolve()
        reference_root.mkdir(parents=True, exist_ok=True)
        target = (reference_root / asset_path).resolve()
        try:
            target.relative_to(reference_root)
        except ValueError as exc:
            raise LookupError("Draft reference path is outside the draft directory") from exc
        if not target.is_file():
            raise LookupError("Draft reference image not found")
        return target

    def _get_owned_task(self, user: User, task_id: str) -> UserTask:
        task = self.db.scalar(
            select(UserTask).where(
                UserTask.id == task_id,
                UserTask.owner_user_id == user.id,
            )
        )
        if task is None:
            raise LookupError(f"Task '{task_id}' not found")
        return task

    def _task_dir(self, user: User, task_id: str) -> Path:
        owner_slug = f"{user.username}-{user.id}"
        return self.settings.user_tasks_root / owner_slug / task_id

    def _draft_dir(self, user: User, draft_id: str) -> Path:
        owner_slug = f"{user.username}-{user.id}"
        return self.settings.user_tasks_root / owner_slug / "_drafts" / draft_id

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        cleaned = Path(filename).name.strip()
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", cleaned)
        return cleaned.strip(".-")

    @staticmethod
    def _unique_path(directory: Path, filename: str) -> Path:
        candidate = directory / filename
        if not candidate.exists():
            return candidate
        stem = candidate.stem
        suffix = candidate.suffix
        counter = 2
        while True:
            alternative = directory / f"{stem}-{counter}{suffix}"
            if not alternative.exists():
                return alternative
            counter += 1

    def _copy_draft_references(self, user: User, draft_id: str | None, task_dir: Path) -> None:
        if not draft_id:
            return
        source_reference_dir = self._draft_dir(user, draft_id) / "reference"
        if not source_reference_dir.is_dir():
            return
        target_reference_dir = task_dir / "reference"
        shutil.copytree(source_reference_dir, target_reference_dir, dirs_exist_ok=True)
